//  A global object which abstracts more difficult implementations of retrieving data from YouTube.
define(['levenshtein', 'dataSource'], function (levenshtein, DataSource) {
    'use strict';

    var videoInformationFields = 'author,title,media:group(yt:videoid,yt:duration),yt:accessControl';
    var videosInformationFields = 'entry(' + videoInformationFields + ')';
    var developerKey = 'AI39si7voIBGFYe-bcndXXe8kex6-N_OSzM5iMuWCdPCSnZxLB_qIEnQ-HMijHrwN1Y9sFINBi_frhjzVVrYunHH8l77wfbLCA';
    
    //  Some videos aren't allowed to be played in Streamus, but we can respond by finding similiar.
    function validateEntry(entry) {
        var ytAccessControlList = entry.yt$accessControl;

        var embedAccessControl = _.find(ytAccessControlList, function (accessControl) {
            return accessControl.action === 'embed';
        });

        var isValid = embedAccessControl.permission === 'allowed';

        return isValid;
    }

    function findPlayableByTitle(title, callback) {
        search(title, function (videoInformationList) {

            videoInformationList.sort(function (a, b) {
                return levenshtein(a.title.$t, title) - levenshtein(b.title.$t, title);
            });

            var videoInformation = videoInformationList.length > 0 ? videoInformationList[0] : null;
            callback(videoInformation);
        });
    };

    //  Performs a search of YouTube with the provided text and returns a list of playable videos (<= max-results)
    function search(text, callback) {

        var searchIndex = 1;
        var timeInterval = 200;
        var timeToSpendSearching = 500;
        var elapsedTime = 0;

        var videoInformationList = [];
        var maxResultsPerSearch = 50;

        var searchInterval = setInterval(function () {
            elapsedTime += timeInterval;

            if (elapsedTime < timeToSpendSearching) {
                //  Be sure to filter out videos and suggestions which are restricted by the users geographic location.
                $.ajax({
                    type: 'GET',
                    url: 'https://gdata.youtube.com/feeds/api/videos',
                    dataType: 'json',
                    data: {
                        category: 'Music',
                        time: 'all_time',
                        'max-results': maxResultsPerSearch,
                        'start-index': searchIndex,
                        format: 5,
                        v: 2,
                        alt: 'json',
                        q: text,
                        key: developerKey,
                        fields: videosInformationFields,
                        strict: true
                    },
                    success: function(result) {

                        if (result.feed.entry) {
                            videoInformationList = videoInformationList.concat(result.feed.entry);
                        }

                        searchIndex += maxResultsPerSearch;
                    },
                    error: function(error) {
                        console.error(error);
                    }
                });
            }
            else {
                clearInterval(searchInterval);
                callback(videoInformationList);
            }
        }, timeInterval);
    };
    
    function tryGetIdFromUrl(url, identifier) {
        var urlTokens = url.split(identifier);

        var dataSourceId = '';

        if (urlTokens.length > 1) {
            dataSourceId = url.split(identifier)[1];
            
            var ampersandPosition = dataSourceId.indexOf('&');
            if (ampersandPosition !== -1) {
                dataSourceId = dataSourceId.substring(0, ampersandPosition);
            }
        }

        return dataSourceId;
    }
    
    return {
        
        getBulkRelatedVideoInformation: function(videoIds, callback) {
            //  Fetch multiple videos from YouTube is as easy as piping the ids together.
            var videoIdList = videoIds.join('|');

            console.log("video id list:", videoIdList);
            
            //  Do an async request for the videos's related videos. There isn't a hard dependency on them existing right as a video is created.
            $.ajax({
                type: 'GET',
                url: 'https://gdata.youtube.com/feeds/api/videos/' + videoIdList + '/related',
                dataType: 'json',
                data: {
                    category: 'Music',
                    v: 2,
                    alt: 'json',
                    key: developerKey,
                    fields: videosInformationFields,
                    //  Don't really need that many suggested videos, take 5.
                    'max-results': 5,
                    strict: true
                },
                success: function (result) {

                    console.log("Result:", result);

                    var playableEntryList = [];
                    var unplayableEntryList = [];

                    _.each(result.feed.entry, function (entry) {

                        var isValid = validateEntry(entry);

                        if (isValid) {
                            playableEntryList.push(entry);
                        } else {
                            unplayableEntryList.push(entry);
                        }

                    });

                    var deferredEvents = [];

                    _.each(unplayableEntryList, function (entry) {

                        var deferred = $.Deferred(function (dfd) {

                            findPlayableByTitle(entry.title.$t, function (playableEntry) {
                                playableEntryList.push(playableEntry);
                                dfd.resolve();
                            });

                        }).promise();

                        deferredEvents.push(deferred);
                    });

                    $.when(deferredEvents).then(function () {

                        if (callback) {
                            callback(playableEntryList);
                        }
                    });

                },
                error: function (error) {
                    console.error(error);
                }
            });

        },
        
        //  When a video comes from the server it won't have its related videos, so need to fetch and populate.
        getRelatedVideoInformation: function (videoIds, callback) {


            //  Do an async request for the videos's related videos. There isn't a hard dependency on them existing right as a video is created.
            $.ajax({
                type: 'GET',
                url: 'https://gdata.youtube.com/feeds/api/videos/' + videoIds + '/related',
                dataType: 'json',
                data: {
                    category: 'Music',
                    v: 2,
                    alt: 'json',
                    key: developerKey,
                    fields: videosInformationFields,
                    //  Don't really need that many suggested videos, take 5.
                    'max-results': 5,
                    strict: true
                },
                success: function (result) {

                    console.log("Result:", result);

                    var playableEntryList = [];
                    var unplayableEntryList = [];

                    _.each(result.feed.entry, function(entry) {

                        var isValid = validateEntry(entry);

                        if (isValid) {
                            playableEntryList.push(entry);
                        } else {
                            unplayableEntryList.push(entry);
                        }

                    });
                    
                    var deferredEvents = [];

                    _.each(unplayableEntryList, function (entry) {
                        
                        var deferred = $.Deferred(function (dfd) {

                            findPlayableByTitle(entry.title.$t, function (playableEntry) {
                                playableEntryList.push(playableEntry);
                                dfd.resolve();
                            });

                        }).promise();
                        
                        deferredEvents.push(deferred);
                    });

                    $.when(deferredEvents).then(function () {

                        if (callback) {
                            callback(playableEntryList);
                        }
                    });

                },
                error: function(error) {
                    console.error(error);
                }
            });
        },

        search: search,
        //  Takes a URL and returns parsed URL information such as schema and video id if found inside of the URL.
        parseVideoIdFromUrl: function (url) {
            var videoId = null;

            var match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?.*?\&v=)([^#\&\?]*).*/);
            if (match && match[2].length === 11) {
                videoId = match[2];
            }

            return videoId;
        },
        
        parseUrlForDataSource: function (url) {

            var dataSource = {
                id: null,
                type: DataSource.USER_INPUT
            };
            
            //  Try for PlaylistId:
            var dataSourceId = tryGetIdFromUrl(url, 'list=PL');
            
            if (dataSourceId !== '') {
                dataSource = {
                    id: dataSourceId,
                    type: DataSource.YOUTUBE_PLAYLIST
                };
            } else {
                
                //  Try feed from a user URL
                dataSourceId = tryGetIdFromUrl(url, '/user/');
                
                //  Maybe they gave a channel ID instead which works same as user
                if (dataSourceId === '') {
                    dataSourceId = tryGetIdFromUrl(url, '/channel/');
                }
                
                if (dataSourceId !== '') {
                    dataSource = {
                        id: dataSourceId,
                        type: DataSource.YOUTUBE_CHANNEL
                    };
                } else {

                    dataSourceId = tryGetIdFromUrl(url, 'streamus:');
                    
                    if (dataSourceId !== '') {
                        dataSource = {
                            id: dataSourceId,
                            type: DataSource.SHARED_PLAYLIST
                        };
                    }

                }
            }

            return dataSource;
        },
        
        getChannelName: function (channelId, callback) {
            
            $.ajax({
                type: 'GET',
                url: 'https://gdata.youtube.com/feeds/api/users/' + channelId,
                dataType: 'json',
                data: {
                    v: 2,
                    alt: 'json',
                    key: 'AI39si7voIBGFYe-bcndXXe8kex6-N_OSzM5iMuWCdPCSnZxLB_qIEnQ-HMijHrwN1Y9sFINBi_frhjzVVrYunHH8l77wfbLCA'
                },
                success: function (result) {

                    if (callback) {
                        callback(result.entry.author[0].name.$t);
                    }
                },
                error: function (error) {
                    console.error(error);

                    if (callback) {
                        callback('Error getting channel name');
                    }
                }
            });

        },
        
        getPlaylistTitle: function (playlistId, callback) {
            
            $.ajax({
                type: 'GET',
                url: "https://gdata.youtube.com/feeds/api/playlists/" + playlistId,
                dataType: 'json',
                data: {
                    v: 2,
                    alt: 'json',
                    key: developerKey,
                    fields: 'title',
                    strict: true
                },
                success: function (result) {
                    if (callback) {
                        callback(result.feed.title.$t);
                    }
                },
                error: function (error) {
                    console.error(error);
                }
            });
        },

        getVideoInformation: function (config) {
            //videoId, optionalVideoTitle, callback
            $.ajax({
                type: 'GET',
                url: 'https://gdata.youtube.com/feeds/api/videos/' + config.videoId,
                dataType: 'json',
                data: {
                    v: 2,
                    alt: 'json',
                    format: 5,
                    key: developerKey,
                    fields: videoInformationFields,
                    strict: true
                },
                success: function (result) {

                    //  result will be null if it has been banned on copyright grounds
                    if (result == null) {
                        
                        if (config.videoTitle && $.trim(config.videoTitle) != '') {

                            findPlayableByTitle(config.videoTitle, function (playableVideoInformation) {
                                config.callback(playableVideoInformation);
                            });
                        }

                    } else {

                        var isValid = validateEntry(result.entry);
                        
                        if (isValid) {
                            config.success(result.entry);
                        } else {
                            findPlayableByTitle(result.entry.title.$t, function (playableVideoInformation) {
                                config.success(playableVideoInformation);
                            });
                        }
                        
                    }

                },
                //  This error is silently consumed and handled -- it is an OK scenario if we don't get a video... sometimes
                //  they are banned on copyright grounds. No need to log this error.
                error: function () {
                    config.error();
                }
            });
        },
        
        getDataSourceResults: function(dataSource, currentIteration, callback) {

            //  Only get data from bulky dataSources.
            if (dataSource.type !== DataSource.YOUTUBE_CHANNEL && dataSource.type !== DataSource.YOUTUBE_PLAYLIST) return;

            var url;
            
            if (dataSource.type == DataSource.YOUTUBE_CHANNEL) {
                url = 'https://gdata.youtube.com/feeds/api/users/' + dataSource.id + '/uploads';
            }
            else if (dataSource.type == DataSource.YOUTUBE_PLAYLIST) {
                url = 'https://gdata.youtube.com/feeds/api/playlists/' + dataSource.id;
            }

            var maxResultsPerSearch = 50;
            var startIndex = 1 + (maxResultsPerSearch * currentIteration);

            $.ajax({
                type: 'GET',
                url: url,
                dataType: 'json',
                
                data: {
                    v: 2,
                    alt: 'json',
                    key: 'AI39si7voIBGFYe-bcndXXe8kex6-N_OSzM5iMuWCdPCSnZxLB_qIEnQ-HMijHrwN1Y9sFINBi_frhjzVVrYunHH8l77wfbLCA',
                    'max-results': maxResultsPerSearch,
                    'start-index': startIndex,
                },
                success: function (result) {

                    //  If the video duration has not been provided, video was deleted - skip.
                    var validResults = _.filter(result.feed.entry, function (resultEntry) {
                        return resultEntry.media$group.yt$duration !== undefined;
                    });

                    if (callback) {
                        callback({
                            iteration: currentIteration,
                            results: validResults
                        });
                    }
                },
                error: function (error) {
                    console.error(error);

                    if (callback) {
                        callback({
                            iteration: currentIteration,
                            results: []
                        });
                    }
                }
            });

        }
    };
});