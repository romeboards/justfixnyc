'use strict';


angular.module('core').controller('ContactController', ['$rootScope', '$scope', 'Authentication', 'deviceDetector',
	function($rootScope, $scope, Authentication, deviceDetector) {
		// This provides Authentication context.
		$scope.authentication = Authentication;
    $scope.device = deviceDetector;

	}
]);
