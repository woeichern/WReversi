var ss = SpreadsheetApp.getActiveSpreadsheet();

var sheetConfig = ss.getSheetByName('config');
var sheetRoom = ss.getSheetByName('room');
var sheetTemplate = ss.getSheetByName('template');

var configLine = getConfig(2);

var LINE_CHANNEL_ACCESS_TOKEN = configLine.ChannelAccessToken;
var LINE_HEADERS = {'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN,};

var blankTemplate = JSON.parse(sheetTemplate.getRange(3, 2).getValue());
var blackTemplate = JSON.parse(sheetTemplate.getRange(4, 2).getValue());
var whiteTemplate = JSON.parse(sheetTemplate.getRange(5, 2).getValue());
var roomTemplate = JSON.parse(sheetTemplate.getRange(6, 2).getValue());
var markTemplate = JSON.parse(sheetTemplate.getRange(7, 2).getValue());
var boardFlexTemplate = getBoardFlexTemplate();

var currentRoomIndex;
var currentRoomData;
var numRoomRow = sheetRoom.getLastRow();

var xSize;
var ySize;

var directList = [
    {x: 0, y: -1}, //Up
    {x: 0, y: 1}, //Down
    {x: 1, y: 0}, //Right
    {x: -1, y: 0}, //Left
    {x: -1, y: -1}, //Left Up
    {x: 1, y: -1}, //Right Up
    {x: -1, y: 1}, //Leff Down
    {x: 1, y: 1} //Right Down
];

function setPositionChess(position, chess)
{
    currentRoomData['board'][parseInt(position.x)][parseInt(position.y)] = chess;
}

function move(position)
{

    setPositionChess(position, getCurrentPlayer(currentRoomIndex));

    for (var key in directList) {
        var direct = directList[key];
        var ifDirectValid = checkIfDirectValid(position, direct);

        if (ifDirectValid) {
            reversi(position, direct);
        }
    }

    setRoomData();
}

function getRoomIndex(rid)
{
    if (numRoomRow === 1) {
        return false;
    }

    var roomIdList = sheetRoom.getRange(2, 1, numRoomRow-1, 1).getValues();

    for (var i in roomIdList) {
        var room = roomIdList[i][0];

        if (room === rid) {
            return parseInt(i) + 2;
        }
    }

    return false;
}

function getPosition(location)
{

    var xLine = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    var yLine = [1, 2, 3, 4, 5, 6, 7, 8];

    var x = xLine.indexOf(location.substr(0, 1).toUpperCase());
    var y = yLine.indexOf(parseInt(location.substr(1, 1)));

    var position = {x: x, y: y};

    return position;
}

function getConfig(rowIndex)
{
    return JSON.parse(sheetConfig.getRange(rowIndex, 2).getValue());
}

function getBoardFlexTemplate()
{
    return JSON.parse(sheetTemplate.getRange(2, 2).getValue());
}

function getRoomData()
{
    if (currentRoomIndex) {
        return JSON.parse(sheetRoom.getRange(currentRoomIndex, 2).getValue());
    }
}

function setRoomData()
{
    sheetRoom.getRange(currentRoomIndex, 2).setValue(JSON.stringify(currentRoomData));
}

function countCanChess()
{
    var count = 0;

    for (var x = 0; x < xSize; x++) {
        for (var y = 0; y < ySize; y++) {
            var position = {x: x, y: y};

            count += checkIfNext(position) ? 1 : 0;
        }
    }

    return count;
}

function getPositionChess(position)
{
    return currentRoomData['board'][parseInt(position.x)][parseInt(position.y)];
}

function countTarget(target)
{
    var count = 0;

    for (var x = 0; x < xSize; x++)  {
        for (var y = 0; y < ySize; y++) {
            var position = {x: x, y: y};

            count += getPositionChess(position) === target ? 1 : 0;
        }
    }

    return count;
}

function countBlack()
{
    return countTarget(1);
}

function countWhite()
{
    return countTarget(2);
}

function reversiPosition(position)
{
    setPositionChess(position, getCurrentPlayer());
}

function reversi(position, direct)
{

    nextPosition = getNextPosition(position, direct);

    while (checkIfOpponent(nextPosition)) {
        reversiPosition(nextPosition);
        nextPosition = getNextPosition(nextPosition, direct);
    }

    setRoomData();
}

function getCurrentPlayer()
{
    return currentRoomData['player'];
}

function getCurrentOpponent()
{
    return getCurrentPlayer() === 1 ? 2 : 1;
}

function changePlayer()
{
    currentRoomData['player'] = getCurrentOpponent();
    setRoomData();
}

function checkIfNext(position)
{
    var ifBlank = checkIfBlank(position);

    if (!ifBlank) {
        return false;
    }

    var checkList = [];

    for (var index in directList) {
        checkList.push(checkIfDirectValid(position, directList[index]));
    }

    var ifHasOneDirectValid = checkList.reduce(function (total, value) {
        return total || value;
    });

    return ifHasOneDirectValid;
}

function setBoardFlex(boardFlexInput)
{
    var boardFlex = boardFlexInput;

    for (var x = 0; x < xSize; x++) {
        for (var y = 0; y < ySize; y++) {
            var position = {x: x, y: y};

            var currentBlackChees = getPositionChess(position);
            var currentBlack = blankTemplate;

            var position = {x: parseInt(x), y: parseInt(y)};

            switch(currentBlackChees) {

                case 1:
                    currentBlack = blackTemplate;
                    break;

                case 2:
                    currentBlack = whiteTemplate;
                    break;

                case 0:
                default:

                    var ifNext = checkIfNext(position);

                    if (ifNext) {
                        currentBlack = markTemplate;
                    }

                    break;
            }

            boardFlex['body']['contents'][1]['contents'][parseInt(x)+1]['contents'][y] = currentBlack;
        }
    }

    return boardFlex;
}

function makeGameFlexMassage()
{
    var boardFlex = Object.assign({}, boardFlexTemplate);

    boardFlex = setBoardFlex(boardFlex);

    var countCan = countCanChess();
    var gameComment = getCurrentPlayerName() + ' 執手    可著棋點' + countCan + '處';

    if (countCan === 0) {
        changePlayer();
        boardFlex = setBoardFlex(boardFlex);

        countCan = countCanChess();

        if (countCan > 0) {
            gameComment = getCurrentPlayerName() + ' 執手    可著棋點' + countCan + '處';
        } else {
            var result =  countBlack() - countWhite();

            if (result > 0) {
                gameComment = '黑勝';
            } else if (result < 0) {
                gameComment = '白勝';
            } else {
                gameComment = '平手';
            }
        }
    }

    boardFlex['hero']['contents'][0]['text']  = gameComment;

    boardFlex['header']['contents'][1]['text'] = countBlack().toString();
    boardFlex['header']['contents'][3]['text'] = countWhite().toString();

    return {
        type: "flex",
        altText: "Board",
        contents: boardFlex
    };
}

function checkIfMoveComand(command)
{

    var re1 = /[A-Ha-h]{1}/ ;
    var re2 = /[1-8]{1}/ ;

    var ifLengthValid = command.length === 2;
    var xValid = re1.test(command.substr(0, 1));
    var yValid = re2.test(command.substr(1, 1));

    return ifLengthValid && xValid && yValid;
}

function getCurrentPlayerName()
{
    return getCurrentPlayer() === 1 ? '黑' : '白';
}

function getNextPosition(position, direct)
{
    return {x: parseInt(position.x)+direct.x, y: parseInt(position.y)+direct.y};
}

function checkIfDirectValid(position, direct)
{

    var targetPosition = getNextPosition(position, direct);

    var ifOpponent = checkIfOpponent(targetPosition);

    if (!ifOpponent) {
        return false;
    }

    var ifFindPlayer = false;

    nextPosition = getNextPosition(targetPosition, direct);

    while (!checkIfOutside(nextPosition) && !checkIfBlank(nextPosition)) {
        if (checkIfPlayer(nextPosition)) {
            ifFindPlayer = true;
            break;
        } else {
            nextPosition = getNextPosition(nextPosition, direct);
        }
    }

    return ifFindPlayer;
}

function checkIfOutside(targetPosition)
{

    if (targetPosition.y > ySize-1 || targetPosition.x > xSize-1 || targetPosition.x < 0 || targetPosition.y < 0) {
        return true;
    }

    return false;
}

function checkIfOpponent(targetPosition)
{
    return checkIf(targetPosition, getCurrentOpponent());
}

function checkIfPlayer(targetPosition)
{
    return checkIf(targetPosition, getCurrentPlayer());
}

function checkIfBlank(targetPosition)
{
    return checkIf(targetPosition, 0);
}

function checkIf(targetPosition, check) {

    var ifOutside = checkIfOutside(targetPosition);

    if (ifOutside) {
        return false;
    }

    var target = getPositionChess(targetPosition);

    return target === check;
}

function checkIfValidMove(position)
{

    if (!checkIfBlank(position)) {
        return false;
    }

    var checkList = [];

    for (var index in directList) {
        checkList.push(checkIfDirectValid(position, directList[index]));
    }

    var ifHasOneDirectValid = checkList.reduce(function (total, value) {
        return total || value;
    });

    var ifPositionBlank = checkIfBlank(position);

    return ifHasOneDirectValid && ifPositionBlank;
}

function resetBoard()
{
    currentRoomData = roomTemplate;

    setRoomData();
}

function getCommands(text)
{
    return text.split(':');
}

function addRoom(rid)
{
    sheetRoom.appendRow([rid, JSON.stringify(roomTemplate)]);
    currentRoomIndex = getRoomIndex(rid);
}

// Webhook main function
function doPost(e)
{

    var eventObject = JSON.parse(e.postData.contents).events[0];

    var replyToken  = eventObject.replyToken;
    var rid = eventObject.source.roomId;
    var type = eventObject.type;

    currentRoomIndex = getRoomIndex(rid);

    if (!currentRoomIndex) {
        addRoom(rid);
    }

    currentRoomData = getRoomData();

    xSize = currentRoomData['board'].length;
    ySize = currentRoomData['board'][0].length;

    switch(type) {

        case 'message':

            var arguments = getCommands(eventObject.message.text);

            var command = arguments[0];

            if(arguments.length > 1){

                var subcommand = arguments[1];

                switch(command){

                    case 'game':
                    default:

                        switch(subcommand){

                            case 'reset':
                                resetBoard();
                                break;

                            case 'status':
                            default:
                                break;
                        }

                        break;
                }

            } else {

                var ifMoveCommand = checkIfMoveComand(command);

                if (ifMoveCommand) {

                    var position = getPosition(command);

                    var ifValidMove = checkIfValidMove(position);

                    if (ifValidMove) {
                        move(position);
                        changePlayer();
                    }
                }
            }

            break;

        default:

            break;

    }

    replyGameBoardMessage(replyToken);
}

/* LINE reply function*/

// To reply simple text message
function replySimpleMessage(replyToken, message)
{
    replyMessage(replyToken, [{type:"text",text: message}]);
}

// To reply message
function replyMessage(replyToken, messageList)
{

    UrlFetchApp.fetch(
		configLine.API.Reply,
		{
			headers: LINE_HEADERS,
			method: 'post',
			payload: JSON.stringify({
				replyToken: replyToken,
				messages: messageList
			})
		}
    );
}

// To reply game board message

function replyGameBoardMessage(replyToken)
{
    var gameFlexMassage = makeGameFlexMassage();

    replyMessage(replyToken, [gameFlexMassage]);
}

function doGet(e)
{

    currentRoomIndex = getRoomIndex('Raf9fd3744e052147bb93841275fa80a5');
    currentRoomData = getRoomData();

    xSize = currentRoomData['board'].length;
    ySize = currentRoomData['board'][0].length;

    var list = [];

    for (var x = 0; x < xSize; x++) {
        for (var y = 0; y < ySize; y++) {
            var position = {x: x, y: y};

            list.push(checkIfNext(position));
        }
    }

    var JSONString = JSON.stringify(list);
    return ContentService.createTextOutput(JSONString)
        .setMimeType(ContentService.MimeType.JSON);
}
