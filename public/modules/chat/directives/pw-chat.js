'use strict';

angular.module('chat')
.directive('pwChat', ['$location', 'Socket',
function($location, Socket) {
  return {
    restrict: 'E',	
    templateUrl: 'modules/chat/directives/pw-chat.html',
		scope: {},
		link: function(scope, element, attrs) {
			
			scope.data =  [
			 {
				 "year":           1950,
				"harmValue":             70 
				},
				{
				 "year":           1951,
				"harmValue":             34 
				}];
				
				/*
				scope.bars.color(
					scope.data.map(function(d,i) {
						return d.color || '#FF0000';
					}).filter(function(d,i) { return !scope.data[i].disabled; })
				);
				*/
				scope.bars={};
				scope.bars.color(scope.data.map(function(d,i) {
					return d.color || '#FF0000';
				}));
				
				
			// Create a messages array
			scope.messages = [];

			// Make sure the Socket is connected
			if (!Socket.socket) {
				Socket.connect();
			}

			// Add an event listener to the 'chatMessage' event
			Socket.on('chatMessage', function (message) {
				scope.messages.unshift(message);
			});

			// Create a method for sending messages
			scope.sendMessage = function () {
				// Create a new message object
				var message = {
					text: scope.messageText
				};

				// Emit a 'chatMessage' message event
				Socket.emit('chatMessage', message);

				// Clear the message text
				scope.messageText = '';
			};

			// Remove the event listener when the directive instance is destroyed
			scope.$on('$destroy', function () {
				Socket.removeListener('chatMessage');
			});
			
    }
  };
}]);