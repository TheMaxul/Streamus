//  This is the list of playlists on the playlists tab.
define(['playlistsContextMenu', 'ytHelper', 'backgroundManager'], function (contextMenu, ytHelper, backgroundManager) {
    //  TODO: Make this sortable and should inherit from a common List object. 
    var playlistList = $('#PlaylistList ul');
    //  TODO: Need to be a lot more fine-grained then just spamming reload. Will come back around to it.
    // TODO: This will need to be reworked to support >1 streams.

    backgroundManager.on('change:activePlaylist', reload);

    var activePlaylists = backgroundManager.get('activeStream').get('playlists');
    activePlaylists.on('add remove change:title', reload);

    backgroundManager.on('change:activeStream', function(model, activeStream) {

        activePlaylists.off('add remove change:title');
        activePlaylists = activeStream.get('playlists');
        activePlaylists.on('add remove change:title', reload);

        reload();
    });

    reload();

    //  Refreshes the playlist display with the current playlist information.
    function reload() {
        playlistList.empty();

        var activeStream = backgroundManager.get('activeStream');

        var firstListId = activeStream.get('firstListId');
        var currentList = activeStream.get('playlists').get(firstListId);
        
        //  Build up each row.
        do {
            (function (list) {
                var listItem = $('<li/>').appendTo(playlistList);

                $('<a/>', {
                    id: list.get('id'),
                    href: '#' + list.get('id'),
                    text: list.get('title'),
                    contextmenu: function (e) {
                        contextMenu.initialize(list);
                        contextMenu.show(e.pageY, e.pageX);
                        //  Prevent default context menu display.
                        return false;
                    }
                }).appendTo(listItem);
                
                //if (list.get('selected')) {
                //    selectRow(list.get('id'));
                //}

            })(currentList);
            
            currentList = activeStream.get('playlists').get(currentList.get('nextListId'));

        } while (currentList.get('id') !== firstListId)

        selectRow(backgroundManager.get('activePlaylist').get('id'));

        //  Removes the old 'current' marking and move it to the newly selected row.
        function selectRow(id) {
            playlistList.find('li').removeClass('loaded');
            $('#' + id).parent().addClass('loaded');
        };

        //  Clicking on a playlist will select that playlist.
        playlistList.children().click(function () {
            var playlistId = $(this).children()[0].id;
            selectRow(playlistId);

            console.log("playlistID:", playlistId, typeof(playlistId));

            var playlist = backgroundManager.getPlaylistById(playlistId);
            backgroundManager.set('activePlaylist', playlist);

            return false;
        });
    }
});