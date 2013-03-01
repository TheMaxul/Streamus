﻿define(['playlistManager', 'player'], function (playlistManager, player) {
    'use strict';
    
    //  Receive keyboard shortcuts from users.
    chrome.commands.onCommand.addListener(function (command) {
        switch (command) {
            case 'nextVideo':
                playlistManager.skipItem("next");
                break;
            case 'previousVideo':
                playlistManager.skipItem("previous");
                break;
            case 'toggleVideo':
                if (player.playerState === PlayerStates.PLAYING) {
                    player.play();
                } else {
                    player.pause();
                }
                break;

        }
    });

    //  http://stackoverflow.com/questions/5235719/how-to-copy-text-to-clipboard-from-a-google-chrome-extension
    //  Copies text to the clipboard. Has to happen on background page due to elevated privs.
    chrome.extension.onMessage.addListener(function (msg, sender, sendResponse) {
        var textarea = document.getElementById("HiddenClipboard");
        //  Put message in hidden field.
        textarea.value = msg.text;
        //  Copy text from hidden field to clipboard.
        textarea.select();
        document.execCommand("copy", false, null);
        //  Cleanup
        sendResponse({});
    });

    chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
        switch (request.method) {
            case 'getPlaylists':
                sendResponse({ playlists: playlistManager.playlists });
                break;
            case 'addVideoByIdToPlaylist':
                playlistManager.addVideoByIdToPlaylist(request.id, request.playlistId);
                break;
            default:
                window && console.error("Unhandled request method:", request.method);
                break;
        }
    });
    
    chrome.webRequest.onBeforeSendHeaders.addListener(function (info) {
        
        var cookieRequestHeader = _.find(info.requestHeaders, function(requestHeader) {
            return requestHeader.name === 'Cookie';
        });
        
        if (cookieRequestHeader) {
            //  force youtube to gimmie the sexy html5 loader. muahaha!
            var flashCookieValue = 'f3=40000';
            var html5CookieValue = 'f2=40000000';
            
            if (cookieRequestHeader.value.indexOf(flashCookieValue) !== -1) {
                cookieRequestHeader.value = cookieRequestHeader.value.replace(flashCookieValue, html5CookieValue);
            } else {
                cookieRequestHeader.value += '&' + html5CookieValue;
			}

        }

        //  Bypass YouTube's embedded player content restrictions by looking like I'm ... youtube! 
        info.requestHeaders.push({  
            name: "Referer",
            value: "http://youtube.com"
        });
        return { requestHeaders: info.requestHeaders };
    }, {
        urls: ["<all_urls>"]
    },
        ["blocking", "requestHeaders"]
    );
    
    //  Build iframe after onBeforeSendHeaders listener to prevent errors and generate correct type of player.
    $('<iframe>', {
        id: 'MusicHolder',
        width: 475,
        height: 286,
        src: 'http://www.youtube.com/embed/undefined?enablejsapi=1'
    }).appendTo('body');
});