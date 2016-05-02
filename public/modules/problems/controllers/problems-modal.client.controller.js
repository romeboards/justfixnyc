'use strict';

angular.module('problems').controller('ModalProblemController', ['$scope', 'Problems', '$modalInstance', 'issues', 'userProblem',
	function($scope, problems, $modalInstance, issues, userProblem) {
		$scope.issues = issues;
		$scope.checkString = '';
		$scope.tempIssues = [];
		$scope.other = undefined;

		// Active mapper/other issue tracker
		for (var i = 0; i < userProblem.issues.length; i++) {
			// Temp issues is a new copy of our user Problems -- we can't use the actual user Problem, because it could be directly from our user's object
			$scope.tempIssues.push(userProblem.issues[i]);
			// Check string handles our active state on init, so when we call our problem-issue-item directive (line 10)
			$scope.checkString += userProblem.issues[i].key;
			
			// If issues exists for this problem, create it in the scope and we'll reference it in the problem-issue-directive (line 33)
			if(userProblem.issues[i].key == 'other') {
				$scope.other = $scope.tempIssues[i];
				$scope.tempIssues.splice(i, 1);
			}
		}

		$scope.save = function(){
			// did we end up making our other issue -- if it's not created in the above loop or the actual directive, then this doesn't get fired
			if($scope.other) {
				$scope.tempIssues.push($scope.other);
			}
			// Pass our temporary copy w/ updates back up our modal function at problem-checklist directive (line 93)
			$modalInstance.close($scope.tempIssues);
		}
		$scope.cancel = function(){
			console.log(userProblem.issues);
			$modalInstance.close();
		}

	}])