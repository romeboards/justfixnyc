'use strict';

//Issues service used to communicate Issues REST endpoints
angular.module('actions').factory('Actions', ['$resource',
  function($resource) {
    return $resource('actions', {}, {
      // update: {
      //   method: 'PUT'
      // }
    });
  }
]);