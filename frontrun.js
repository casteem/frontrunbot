var axios = require('axios');
var FULL_CURATION_TIME = 30 * 60 * 1000;
var api_url = 'https://steembottracker.net';
var fs = require('fs');
var steem = require('steem');

var fs = require('fs');
var path = require('path');
//var jsonPath = path.join(__dirname, '..', 'frontrun', 'fconfig.json');
//var utilPath = path.join(__dirname, '..', 'frontrun', 'futils.js');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var utils = require('./utils');
var frontrun = config.frontrun;

var cPostInterval = frontrun.cPostInterval * 1000;
var VPlimit = frontrun.VPlimit * 100;
var numPosts = frontrun.numPosts;
var sVote = 0;
var fVote = 0;
var counter = 0;
var authors = [];
var permlinks = [];
var vp;
var account = null;
var min;
var posts;

start();
async function start() {
    await getVP();
    frontRun();
}

function getVP() {
    steem.api.getAccounts([config.account], function (err, result) {
        if (result) {
            account = result[0];
            vp = utils.getVotingPower(account);
        }
    });
}


function frontRun() {
    axios
        .get(api_url + '/posts')
        .then(data => {
            posts = data.data;

            var num_loaded = 0;
            posts.forEach(function (post) {
                var permLink = post.permlink;
                var author = post.author;


                steem.api.getContent(author, permLink, function (err, result) {
                    if (!err && result && result.id > 0) {
                        post.created = new Date(result.created + 'Z');
                        post.payout = parseFloat(result.pending_payout_value);
                        post.title = result.title;
                        post.author = result.author;
                        post.permlink = result.permlink;

                        var pre_30_min_pct = Math.min(new Date() - new Date(result.created + 'Z'), FULL_CURATION_TIME) / FULL_CURATION_TIME;
                        post.curation_reward = (Math.sqrt((post.payout + 1) * 0.25) - Math.sqrt(post.payout * 0.25)) * Math.sqrt((post.payout + 1 + post.vote_value) * 0.25) * pre_30_min_pct;

                    }

                    num_loaded++;

                    if (num_loaded >= posts.length) {
                        posts.sort(function (a, b) { return parseFloat(b.curation_reward) - parseFloat(a.curation_reward) });
                        scurate(posts);
                    }
                })
            })
        });
}


function scurate(posts) {

    for (var i = 0; i < posts.length; i++) {
        authors.push(posts[i].author);
        permlinks.push(posts[i].permlink);
    }

    //Calculate the actual data size comparing with numofposts to be upvoted
    min = Math.min(permlinks.length, numPosts);

    var Table = require('cli-table2');
    var table = new Table({
        head: ["index", "author", "permlinks"],
        wordWrap: true
    });

    for (var i = 0; i < permlinks.length; i++) {
        table.push([i+1, authors[i], permlinks[i]]);
    }

    console.log(table.toString());
    myLoop(j = 0);
    sVote = 0;
    fVote = 0;
}

//Keep looping until you satisfy Counter of successful votes = numposts
//If number of successful vote met, stop the loop
//If min=1, restart the loop with delay

async function myLoop(j = 0) {
    await sleep(5000);
    getVP();

    console.log('============  Selected numbers of post: ' + min + ' | Total posts: ' + permlinks.length + '========');

    if (min == 0) {
        utils.log("No frontrun posts at the moment")
        setTimeout(frontRun, 30000);
    }

    if (sVote < min) {
        VoteFront(j);
        console.log('j1 in mainloop '+ j)

        //The condition to continue loop or not
        if (++j < permlinks.length && vp >= VPlimit && sVote < min) {
            myLoop(j);
            console.log('j2 in myloop : ' + j);
        }
        
    }
}


function VoteFront(j) {
    if (vp >= VPlimit && numPosts !== '') {
        steem.broadcast.vote(config.posting_key, config.account, authors[j], permlinks[j], (frontrun.voteWeight * 100),
            function (err, result) {

                if (result && !err) {
                    sVote++;
                    utils.log("Frontrunned posts| Author: " + authors[j] + " | Permlink: " + permlinks[j] + " | Vote weight of: " + frontrun.voteWeight + '%');
                    utils.log('Num of failed vote: ' + fVote);
                    utils.log('Num of successful vote: ' + sVote);

                } else if (err) {
                    fVote++;
                    utils.log(err.message + " POST INFO | Author: " + authors[j] + " | Permlink: " + permlinks[j] + ' | Voting Power: ' + utils.format(vp / 100) + '%');
                    utils.log('Num of failed vote: ' + fVote);
                    utils.log('Num of successful vote: ' + sVote);
                }
                //if successful votes match the number setted, refront run again
                if (sVote === min) {
                    let x = async () => {
                        console.log('==========================================================================');
                        console.log('                      Successfully upvoted all posts!!');
                        console.log('==========================================================================');
                        await sleep(10000);
                        authors.length = 0;
                        permlinks.length = 0;
                        start();
                        console.log('j3 in sucess upvote all: ' + j);
                    }
                    x();

                    //Reloop when max data size and if desired number of upvoted post not reached
                } else if (sVote < min && (fVote + sVote === permlinks.length)) {
                    let x = async () => {
                        await sleep(5000);
                        console.log('==========================================================================');
                        console.log('          End of available posts, Refetching new posts to upvote');
                        console.log('==========================================================================');
                        authors.length = 0;
                        permlinks.length = 0;
                        start();
                    }
                    x();
                }            
            })

    } else if (vp < VPlimit) {
        utils.log('You have upvoted to the maximum number of post set per day');

        utils.log('Voting Power: ' + utils.format(vp / 100) + '%' + " is too low to vote!");
        utils.log("Author: " + authors[j] + ' | ' + 'Permlinks: ' + permlinks[j]);

        StartTimer();
    }
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

function StartTimer() {
    let x = async () => {
        await getVP();
        let nTimer = utils.mTimer(vp);

        if (nTimer <= 0) {
            utils.log('Time until recovery to configured VP: ' + VPlimit / 100 + ' % | ' + utils.toTimer(0) + ' | Voting Power: ' + vp)
        } else {
            utils.log('Time until recovery to configured VP: ' + VPlimit / 100 + ' % | ' + utils.toTimer(nTimer) + ' | Voting Power: ' + vp)
        }

        if (vp >= VPlimit) {
            clearInterval(y);
            utils.log('VP fully replenished to the configured amount of ' + VPlimit / 100 + ' %, Starting frontrun!');
            sVote = 0;
            authors.length = 0;            
            permlinks.length = 0;
            frontRun();
        }

    };
    var y = setInterval(x, 10000);
}
