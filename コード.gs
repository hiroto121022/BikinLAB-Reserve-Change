var debugEmailAddress = 'hiroto121022@gmail.com';
var spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREAD_SHEET");
var records = [];

function addRecord(records) {
  var sheetName = "履歴";
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  sheet.appendRow(records);
}
function lineReply(replyToken,altMsg,msgContents) {
  var accessToken = PropertiesService.getScriptProperties().getProperty("ACCESS_TOKEN");
  var apiUrl = 'https://api.line.me/v2/bot/message/reply/';
  var messageData = {
    replyToken: replyToken,
    messages: [
      {
        type: 'flex',
        altText: altMsg,
        contents: msgContents
      }
    ]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    payload: JSON.stringify(messageData)
  };
  // Lineにリプライを送信（1行目）
  var response = UrlFetchApp.fetch(apiUrl, options);
  // レスポンスのログ出力（デバッグ用）
  Logger.log(response.getContentText());
}
function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);

    // メッセージイベントがあるか確認
    if (postData.events && postData.events.length > 0) {
      var event = postData.events[0];

      //テキストメッセージの時
      if (event.type === 'message' && event.message.type === 'text') {
        const datetime = new Date();
        var replyToken = event.replyToken;
        var receivedMessage = event.message.text;
        records[0] = datetime;
        records[1] = replyToken;

        if (!receivedMessage.includes('\n')) {
          // 1行の場合
          if (!receivedMessage.includes('削除')) {
            // 1行で削除が含まれていない場合
            const lineReplyMessage = receivedMessage + " 変更する日付を選択 トークを開いて編集";

            // メッセージの送信
            lineReply(replyToken, lineReplyMessage, editReserve(receivedMessage));

          } else {
            // 1行で削除が含まれている場合
            delReceivedMessage = receivedMessage.replace("削除", "");
            const lineReplyMessage = receivedMessage + " 削除する日付を選択 トークを開いて編集";
            lineReply(replyToken, lineReplyMessage, deleteSalon(delReceivedMessage));
          }
        } else {
          // 複数行の場合
          const msgs = receivedMessage.split('\n');
          const firstMessage = msgs[0];
          const secondMessage = msgs[1];

          if (msgs.length === 2 || msgs.length === 3) {
            // 2,3行の場合
            const thirdMessage = msgs.length === 3 ? msgs[2] : null;

            if (firstMessage.includes('削除')) {
              // 1行目に削除が含まれている場合
              delFirstMessage = firstMessage.replace("削除", "");
              const lineReplyMessage = delFirstMessage + " 削除する時間を選択 トークを開いて編集";
              lineReply(replyToken, lineReplyMessage, deleteReserveDate(delFirstMessage, secondMessage));
            } else {
              // 1行目に削除が含まれていない場合
              const lineReplyMessage = firstMessage + " 変更 トークを開いて編集";

              if (msgs.length === 2) {
                // 2行の場合
                if (secondMessage.includes('削除')) {
                  // 2行で2行目に削除が含まれている
                  delSecondMessage = secondMessage.replace("削除", "");
                  lineReply(replyToken, lineReplyMessage, deleteDate(firstMessage, delSecondMessage));
                  // 記録するデータを取得してスプレッドシートに記載
                  records[2] = `${firstMessage} ${delSecondMessage}を削除`;
                  addRecord(records);
                } else {
                  // 2行で2行目に削除が含まれていない
                  lineReply(replyToken, lineReplyMessage, editReserveDate(firstMessage, secondMessage));
                }
              } else {
                // 3行の場合
                if (thirdMessage.includes('削除')) {
                  // 3行で3行目に削除が含まれている
                  delThirdMessage = thirdMessage.replace("削除", "");
                  lineReply(replyToken, lineReplyMessage, deleteTime(firstMessage, secondMessage, delThirdMessage));
                  records[2] = `${firstMessage} ${secondMessage}の${delThirdMessage}を削除`;
                  addRecord(records);
                } else {
                  // 3行で3行目に削除が含まれていない
                  lineReply(replyToken, lineReplyMessage, editReserveStatus(firstMessage, secondMessage, thirdMessage));
                  addRecord(records);
                }
              }
            }
          }
        }
      // 日付・時間の場合
      } else if (event.type === 'postback') {
        var replyToken = event.replyToken;
        const datetime = new Date();
        records[0] = datetime;
        records[1] = replyToken;
        var backData = event.postback.data;
        var backDatas = backData.split('&');
        var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(backDatas[1]);
        var data = sheet.getDataRange().getValues();

        if (event.postback.params && (event.postback.params.date || event.postback.params.datetime)) {

          if (backDatas.length === 2) {
            var dateValue = new Date(event.postback.params.datetime + ":00");
            // 日付を追加
            var endTime = new Date(dateValue + ":00");
            if (backDatas[1] === "東京サロン") {
              endTime.setMinutes(endTime.getMinutes() + 100);
            } else if (backDatas[1] === "京都サロン") {
              endTime.setMinutes(endTime.getMinutes() + 105);
            } else if (backDatas[1] === "大阪サロン") {
              endTime.setMinutes(endTime.getMinutes() + 105);
            }
            sheet.appendRow([formatDate2(dateValue), formatTime(dateValue), formatTime(endTime), "0"]);
            var lastRow = sheet.getLastRow();
            if (lastRow > 1) {
              var range = sheet.getRange(2, 1, lastRow - 1, 4);
              range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
            }
            lineReply(replyToken, backDatas[1] + "予約状況編集 トークを開いて編集", editReserve(backDatas[1]));
            records[2] = `${backDatas[1]} ${formatDate(dateValue)}の${formatTime(dateValue)}～${formatTime(endTime)}を追加`;
            addRecord(records);

          } else if (backDatas.length === 3) {
            var dateValue = new Date(event.postback.params.date + "T00:00:00");
            // 日付を変更
            for (var i = 1; i < data.length; i++) {
              var rawDate = data[i][0];
              var startTime = data[i][1];
              var endTime = data[i][2];

              if (formatDate(rawDate) === backDatas[2]) {
                rawDate = dateValue;
                sheet.getRange(i + 1, 1).setValue(rawDate);
              }
            }
            var lastRow = sheet.getLastRow();
            var range = sheet.getRange(2, 1, lastRow - 1, 4);
            range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
            lineReply(replyToken, backDatas[1] + "予約状況編集 トークを開いて編集", editReserveDate(backDatas[1] ,formatDate(dateValue)));
            records[2] = `${backDatas[1]} ${backDatas[2]}を${formatDate(dateValue)}に変更`;
            addRecord(records);
          }

        } else if (event.postback.params && event.postback.params.time) {
          var timeValue = event.postback.params.time;
          var parsedTime = new Date("2000-01-01T" + timeValue + ":00");
          if (backDatas[1] === "東京サロン") {
            parsedTime.setMinutes(parsedTime.getMinutes() + 100);
          } else if (backDatas[1] === "京都サロン") {
            parsedTime.setMinutes(parsedTime.getMinutes() + 105);
          } else if (backDatas[1] === "大阪サロン") {
            parsedTime.setMinutes(parsedTime.getMinutes() + 105);
          }

          // 時間追加の処理
          if (backDatas.length === 3) {
            var match = backDatas[2].match(/(\d+)月(\d+)日/);
            if (match) {
              var forDate = match[1] + '/' + match[2];
            }
            sheet.appendRow([forDate, timeValue, formatTime(parsedTime), "0"]);
            var lastRow = sheet.getLastRow();
            if (lastRow > 1) {
              var range = sheet.getRange(2, 1, lastRow - 1, 4);
              range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
            }
            lineReply(replyToken, backDatas[1] + "予約状況編集 トークを開いて編集", editReserveDate(backDatas[1] ,backDatas[2]));
            records[2] = `${backDatas[1]} ${backDatas[2]}に${timeValue}～${formatTime(parsedTime)}を追加`;
            addRecord(records);

          } else if (backDatas.length === 5) {
            if (backDatas[3] === "start") {
              for (var i = 1; i < data.length; i++) {
                var rawDate = data[i][0];
                var startTime = data[i][1];
                var endTime = data[i][2];

                if (formatDate(rawDate) === backDatas[2]) {
                  if (formatTime(startTime) === backDatas[4]){
                    startTime = timeValue;
                    sheet.getRange(i + 1, 2).setValue(startTime);
                  }
                }
              }
              var lastRow = sheet.getLastRow();
              var range = sheet.getRange(2, 1, lastRow - 1, 4);
              range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
              lineReply(replyToken, backDatas[1] + "予約状況編集 トークを開いて編集", editReserveDate(backDatas[1] ,backDatas[2]));
              records[2] = `${backDatas[1]} ${backDatas[2]}の開始時間${backDatas[4]}を${timeValue}に変更`;
              addRecord(records);

            } else if (backDatas[3] === "end") {
              for (var i = 1; i < data.length; i++) {
                var rawDate = data[i][0];
                var startTime = data[i][1];
                var endTime = data[i][2];

                if (formatDate(rawDate) === backDatas[2]) {
                  if (formatTime(endTime) === backDatas[4]){
                    endTime = timeValue;
                    sheet.getRange(i + 1, 3).setValue(endTime);
                  }
                }
              }
              var lastRow = sheet.getLastRow();
              var range = sheet.getRange(2, 1, lastRow - 1, 4);
              range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
              lineReply(replyToken, backDatas[1] + "予約状況編集 トークを開いて編集", editReserveDate(backDatas[1] ,backDatas[2]));
              records[2] = `${backDatas[1]} ${backDatas[2]}の終了時間${backDatas[4]}を${timeValue}に変更`;
              addRecord(records);
            }
          }
        }
      }
    }

  } catch (error) {
    // エラーが発生した場合、エラーメールを送信
    MailApp.sendEmail({
      to: debugEmailAddress,
      subject: 'Error in doPost',
      body: 'Error details: ' + error.message + '\nStack trace: ' + error.stack,
    });
    throw error; // エラーを再スローしてログにも表示
  }

}

function editReserve(where) {
  // シートの名前
  var sheetName = where;
  var salonName = where + " 変更する日付選択";

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  // JSONデータを格納するオブジェクト
  var jsonData = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: salonName, weight: "bold", size: "lg"}
      ],
    },
  };

  var currentDate = "";
  var currentDayData = null;

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);

    // 日付が変わったら新しい日付のボックスを追加
    if (formattedDate !== currentDate) {
      currentDaySep = {
        type: "separator",
        margin: "sm"
      };
      currentDayData = {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: formattedDate, gravity: "center", size: "lg", flex:4 },
        ],
      };
      currentDayButton = {
        type: "button",
        gravity: "center",
        flex: 3,
        action: {
          type: "message",
          label: "変更",
          text: `${where}\n${formattedDate}`
        }
      };
      jsonData.body.contents.push(currentDaySep);
      currentDayData.contents.push(currentDayButton);
      jsonData.body.contents.push(currentDayData);
      currentDate = formattedDate;
    }
  }
  var addTime = {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "button", action: {type: "datetimepicker", data: "add&" + where, mode: "datetime", label: "日付追加"}, height: "sm", flex: 1},
      { type: "button", action: {type: "message",label: "日付削除",text: `${where}削除` }, height: "sm", flex: 1},
    ],
  };
  jsonData.body.contents.push(addTime);

  // JSONをログに出力
  Logger.log(JSON.stringify(jsonData, null, 2));

  return jsonData;
}

function editReserveDate(where,when) {
  // シートの名前
  var sheetName = where;
  var salonName = where + " 変更";

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  // JSONデータを格納するオブジェクト
  var jsonData = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: salonName, weight: "bold", size: "lg"},
        { type: "separator", margin: "md"},
        { type: "box", layout: "horizontal", contents: [
          {type: "text", text: when, gravity: "center",size: "lg",flex: 1},
          {type: "button", action: {type: "datetimepicker",label: "日付ごと変更",data: "edit&" + where + "&" + when,mode: "date"},gravity: "center",flex: 1}
        ]}
      ],
    },
  };

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];
    var startTime = data[i][1];
    var endTime = data[i][2];
    var reservationStatus = data[i][3];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);
    if (formattedDate == when) {

      // 一致する日付を表示
      var reservationInfo = {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: formatTime(startTime) + "～" + formatTime(endTime) , gravity: "center", wrap: false, flex: 3},
          { type: "text", text: reservationStatus === 0 ? "〇" : "×", align: "center" , gravity: "center", flex: 1},
          { type: "button", action: {type: "message",label: "〇×変更",text: `${where}\n${formattedDate}\n${formatTime(startTime) + "～" + formatTime(endTime)}`}, height: "sm",flex: 3},
        ],
      };
      // 一致する日付を表示
      var reservationDate = {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: formatTime(startTime), flex: 1, gravity: "center", wrap: false, align: "center"},
          { type: "button", action: {type: "datetimepicker", data: "edit&" + where + "&" + when + "&start&" + formatTime(startTime), mode: "time", label: "変更"}, height: "sm", flex: 1},
          { type: "text", text: formatTime(endTime), flex: 1, gravity: "center", wrap: false, align: "center"},
          { type: "button", action: {type: "datetimepicker", data: "edit&" + where + "&" + when + "&end&" + formatTime(endTime), mode: "time", label: "変更"}, height: "sm", flex: 1}
        ],
      };
      jsonData.body.contents.push(reservationInfo);
      jsonData.body.contents.push(reservationDate);
    }
  }
  var addTime = {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "button", action: {type: "datetimepicker", data: "add&" + where + "&" + when, mode: "time", label: "時間を追加"}, height: "sm", flex: 1},
      { type: "button", action: {type: "message",label: "時間を削除",text: `${where}削除\n${when}` }, height: "sm", flex: 1},
    ],
  };
  var returnMenu = {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "button", action: {type: "message",label: "日付選択に戻る",text: where }, height: "sm", flex: 1},
    ],
  };
  jsonData.body.contents.push(addTime);
  jsonData.body.contents.push(returnMenu);
  // JSONをログに出力
  Logger.log(JSON.stringify(jsonData, null, 2));

  return jsonData;
}

function editReserveStatus(where,when,state) {
  // シートの名前
  var sheetName = where;

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];
    var startTime = data[i][1];
    var endTime = data[i][2];
    var reservationStatus = data[i][3];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);
    var formattedTime = formatTime(startTime) + "～" + formatTime(endTime);
    if (formattedDate == when) {
      if (formattedTime == state) {
        reservationStatus = (reservationStatus === 0) ? 1 : 0;
        data[i][3] = reservationStatus;
        sheet.getRange(i + 1, 4).setValue(reservationStatus);
        var statusSymbol = (reservationStatus === 0) ? "〇" : "×";
      }
    }
  }
  records[2] = `${where} ${when} ${state}の予約状況を${statusSymbol}に変更`;
  return editReserveDate(where,when);
}

function deleteSalon(where) {
  // シートの名前
  var sheetName = where;
  var salonName = where + " 削除する日付を選択";

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  // JSONデータを格納するオブジェクト
  var jsonData = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: salonName, weight: "bold", size: "lg"}
      ],
    },
  };

  var currentDate = "";
  var currentDayData = null;

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);

    // 日付が変わったら新しい日付のボックスを追加
    if (formattedDate !== currentDate) {
      currentDaySep = {
        type: "separator",
        margin: "sm"
      };
      currentDayData = {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: formattedDate, gravity: "center", size: "lg", flex:4 },
        ],
      };
      currentDayButton = {
        type: "button",
        gravity: "center",
        flex: 3,
        action: {
          type: "message",
          label: "削除",
          text: `${where}\n${formattedDate}削除`
        }
      };
      jsonData.body.contents.push(currentDaySep);
      currentDayData.contents.push(currentDayButton);
      jsonData.body.contents.push(currentDayData);
      currentDate = formattedDate;
    }
  }
  var returnMenu = {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "button", action: {type: "message",label: "予約状況変更に戻る",text: where }, height: "sm", flex: 1},
    ],
  };
  jsonData.body.contents.push(returnMenu);
  // JSONをログに出力
  Logger.log(JSON.stringify(jsonData, null, 2));

  return jsonData;
}

function deleteDate(where,when) {
  // シートの名前
  var sheetName = where;

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  var lastRow = sheet.getLastRow();
  var range = sheet.getRange(2, 1, lastRow - 1, 4);

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);
    if (formattedDate == when) {
      sheet.getRange(i + 1, 1).setValue("");
      sheet.getRange(i + 1, 2).setValue("");
      sheet.getRange(i + 1, 3).setValue("");
      sheet.getRange(i + 1, 4).setValue("");
    }
  }

  range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);

  return deleteSalon(where);
}

function deleteReserveDate(where,when) {
  // シートの名前
  var sheetName = where;
  var salonName = where + " 削除する時間を選択";

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  // JSONデータを格納するオブジェクト
  var jsonData = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: salonName, weight: "bold", size: "lg"},
        { type: "separator", margin: "md"},
        { type: "box", layout: "horizontal", contents: [
          {type: "text", text: when, gravity: "center",size: "lg"}
        ]}
      ],
    },
  };

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];
    var startTime = data[i][1];
    var endTime = data[i][2];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);
    if (formattedDate == when) {

      // 一致する日付を表示
      var reservationInfo = {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: formatTime(startTime) + "～" + formatTime(endTime) , gravity: "center", wrap: false, flex: 1},
          { type: "button", action: {type: "message",label: "削除",text: `${where}\n${formattedDate}\n${formatTime(startTime) + "～" + formatTime(endTime)}削除`}, height: "sm",flex: 1},
        ],
      };
      var returnMenu = {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "button", action: {type: "message",label: "予約状況変更に戻る",text: `${where}\n${formattedDate}` }, height: "sm", flex: 1},
        ],
      };
      jsonData.body.contents.push(reservationInfo);
    }
  }
  jsonData.body.contents.push(returnMenu);
  // JSONをログに出力
  Logger.log(JSON.stringify(jsonData, null, 2));

  return jsonData;
}

function deleteTime(where,salonDate,salonTime) {
  // シートの名前
  var sheetName = where;

  // スプレッドシートからデータを取得
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  var lastRow = sheet.getLastRow();
  var range = sheet.getRange(2, 1, lastRow - 1, 4);

  // データを処理
  for (var i = 1; i < data.length; i++) {
    var rawDate = data[i][0];
    var startTime = data[i][1];
    var endTime = data[i][2];

    // 日付のフォーマット変更
    var formattedDate = formatDate(rawDate);
    var formattedTime = formatTime(startTime) + "～" + formatTime(endTime);
    if (formattedDate == salonDate) {
      if (formattedTime == salonTime) {
        sheet.getRange(i + 1, 1).setValue("");
        sheet.getRange(i + 1, 2).setValue("");
        sheet.getRange(i + 1, 3).setValue("");
        sheet.getRange(i + 1, 4).setValue("");
      }
    }
  }

  range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);

  return deleteReserveDate(where,salonDate);
}

// 日付のフォーマット変更関数
function formatDate(rawDate) {
  var dateObject = new Date(rawDate);
  var month = dateObject.getMonth() + 1;
  var day = dateObject.getDate();
  var dayOfWeek = getDayOfWeek(dateObject.getDay());
  return month + "月" + day + "日" + "(" + dayOfWeek + ")";
}
function formatDate2(rawDate) {
  var dateObject = new Date(rawDate);
  dateObject.setHours(0, 0, 0, 0);
  return dateObject;
}
function getDayOfWeek(dayIndex) {
  var daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];
  return daysOfWeek[dayIndex];
}
// 時間のフォーマット変更関数
function formatTime(rawTime) {
  var timeObject = new Date(rawTime);

  // 時と分を取得
  var hours = timeObject.getHours();
  var minutes = timeObject.getMinutes();

  // 一桁の場合は0を追加
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;

  // 時刻をHH:mm形式にフォーマット
  var formattedTime = hours + ":" + minutes;

  return formattedTime;
}