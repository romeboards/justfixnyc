'use strict';

// Issues controller
angular.module('actions').controller('UpdateActivityController', function ($scope, $modalInstance) {

  //$scope.newUpdate = newUpdate;
  // $scope.selected = {
  //   item: $scope.items[0]
  // };

  $scope.addUpdate = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
});