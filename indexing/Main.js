var searchApp = angular.module('SearchApp', ['ngResource']);

searchApp.factory('SearchAPI', ['$http',
    function ($http) {
        return {
           getDocuments: function () {
               var promise = $http.get('/documents').then(function(response) {
                    return response.data;
               }, function (error) {
                    return [];
               })
               return promise;
            },
            reindexDocuments: function () {
               var promise = $http.post('/reindex').then(function(response) {
                    return true;
               }, function (error) {
                    return false;
               })
               return promise;
            },
            search: function (query) {
                var queryJson = { "query" : query };
                var promise = $http.post('/search', queryJson).then(function(response) {
                    return response.data;
               }, function (error) {
                    return null;
               })
               return promise;
            },
            getResultImage: function(jsonResult) {
                var promise = $http.post('/image', jsonResult).then(function(response) {
                    return response.data;
               }, function (error) {
                    return null;
               })
               return promise;
            }
        }
    }
]);

searchApp.controller('SearchMainController', ['$scope', 'SearchAPI', function($scope, SearchAPI) {

$scope.searchResult = []

$scope.searchString = "";
$scope.status = "Ready";

$scope.reindexClicked = function() {
    $scope.status = "Reindexing....";

    SearchAPI.reindexDocuments().then(function(data) {
        $scope.status = "Finished reindexing";
    });
};

$scope.clearSearchResults = function() {
    $scope.searchResult = []
}

$scope.searchClicked = function() {
    $scope.searchResult = []
    SearchAPI.search($scope.searchString).then(function(jsonResult) {
        $scope.status = "Search finished " + jsonResult.length;
        for (let i = 0; i < jsonResult.length; i++) {
            let result = jsonResult[i];
            $scope.searchResult[i] = result;
            SearchAPI.getResultImage(result).then(function(image) {
                result.image = image;
            });
        }
    });

    $scope.status = "Searching... "  + $scope.searchString;
};

$scope.searchDisabled = function() {
    return $scope.searchString == "";
};

$scope.documents = []

SearchAPI.getDocuments().then(function(data) {
    $scope.documents = data;
});

$scope.documentSize = function() {
    return $scope.documents.length;
};

}]);

