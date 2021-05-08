const express = require("express")
const path = require("path")
const app = express()
const AWS = require("aws-sdk");
const port = 3000

let awsCredentials = new AWS.Credentials(""); 
AWS.config.update({
    region: "eu-west-1",
    credentials: awsCredentials
});

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

//set up path 
let publicPath = path.resolve(__dirname, "public")
app.use(express.static(publicPath))
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname + "/client.html"))
})
app.listen(port, function () {
    console.log("Movie App is listening on " +port)
})

//Make a table in DynamoDB
//Get data from S3 bucket
//Upload data to table
app.get('/createDB', (req, res) => {
    var params = {
        TableName: "Movies",
        KeySchema: [
            { AttributeName: "year", KeyType: "HASH" },  //Partition key
            { AttributeName: "title", KeyType: "RANGE" }  //Sort key
        ],
        AttributeDefinitions: [
            { AttributeName: "year", AttributeType: "N" },
            { AttributeName: "title", AttributeType: "S" }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };
    dynamodb.createTable(params, function (err, data) {
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
    var s3params = {
        Bucket: 'csu44000assignment2',
        Key: 'moviedata.json'
    }
    var s3 = new AWS.S3();
    s3.getObject(s3params, function (err, data) {
        if (err) {
            console.log("Err")
        } else {
            var allMovies = JSON.parse(data.Body.toString());
             allMovies.forEach(function (movie) {
                var params = {
                    TableName: "Movies",
                    Item: {
                        "year": movie.year,
                        "title": movie.title,
                        "director":  movie.info.directors,
                        "rating": movie.info.rating,
                        "rank": movie.info.rank,
                        "release": movie.info.release_date
                    }
                };

                docClient.put(params, function (err, data) {
                    if (err) {
                        console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log(movie.title, " successfully added to the table");
                    }
                });
            });
        }
        console.log("Successfully created database");
    })
});

//Find the movie match the user input (title, year)
//Display this on webpage
app.get('/queryDB/:title/:year', (req, res) => {
    var movieList = {
        queryList :[]
    }
    var year = parseInt(req.params.year)
    var queryTitle = req.params.title.replace(/%20/g, " ");
    var queryParams = {
        TableName : "Movies",
        ProjectionExpression:"#yr, title, director, rating, #rank, #release",
        KeyConditionExpression: "#yr = :yyyy and begins_with (title, :endTitle)",
        ExpressionAttributeNames:{
            "#yr": "year",
            "#rank":"rank",
            "#release":"release"
        },
        ExpressionAttributeValues: {
            ":yyyy": year,
            ":endTitle": queryTitle
        }
    };

    docClient.query(queryParams, function(err, data) {
        if (err) {
            console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
        } else {
            data.Items.forEach(function(item) {
                movieList.queryList.push(
                    {
                        Title: item.title,
                        Year: item.year, 
                        Director: item.director, 
                        Rating: item.rating, 
                        Rank: item.rank, 
                        Release: item.release
                    }
                )
            });
            res.json(movieList)
        }
    });
});

//Delete table 
app.get('/destroyDB', (req, res) => {
    console.log("Destroying");
    var params = {
        TableName : "Movies",
    };
    dynamodb.deleteTable(params, function(err, data) {
        if (err) {
            console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
});
