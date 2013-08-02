﻿define(['helpers'], function(helpers) {
    'use strict';

    var PlaylistItemView = Backbone.View.extend({
        tagName: 'li',
        
        className: 'playlistItem',
        
        template: _.template($('#playlistItemTemplate').html()),
        
        //  TODO: Delegate events to child from parent?
        events: {
            
        },
        
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            
            //  TODO: Probably renamed this to playlistitemid to avoid confusion with listitem's id.
            this.$el.attr('data-itemid', this.model.get('id'));

            var videoDuration = this.model.get('video').get('duration');
            var author = this.model.get('video').get('author');

            var playlistItemInfo = helpers.prettyPrintTime(videoDuration) + ' by ' + author;
            this.$el.find('span.playlistItemInfo').text(playlistItemInfo);

            helpers.scrollElementInsideParent(this.$el.find('span.playlitItemTitle'));

            return this;
        },
        
        initialize: function() {
            this.listenTo(this.model, 'destroy', this.remove);
        }

    });

    return PlaylistItemView;
});