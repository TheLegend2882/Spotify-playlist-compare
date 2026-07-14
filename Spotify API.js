//javascript code to run html app


async function get_token(authOptions) {
    const res = await fetch("https://accounts.spotify.com/api/token", authOptions);
    const data = await res.json();
    return data.access_token;
}


async function client_credientials() {

    const CLIENT_ID = "a8ca54f3da924bcc8bd98dc113959823";
    const CLIENT_SECRET = "f10141db378f44e1970fb349da9ffdfc";

    const auth_64 = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)


    var authOptions = {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + auth_64,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials'
        }),
    };


    const token = await get_token(authOptions);
    console.log('access token',token)

}
// client_credientials()


//1. generate code verifier (string)
const RandomString = (length) => {
    const possible ='QWERTYUIOPASDFGHJKLZXCVBNM1234567890qwertyuiopasdfghjklzxcvbnm';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc,x) => acc + possible[x%possible.length],""); //accumulator function, finding remainder index for generating numbers and string splicing possible

}

//2. converts variable-length string input to fixed-length byte output, code challenger
const sha256 = async (plain) => {
    const encoder = new TextEncoder()
    const data  = encoder.encode(plain)
    const hashed = await window.crypto.subtle.digest('SHA-256',data)
    // fixed length byte string


    const str = String.fromCharCode(...new Uint8Array(hashed))
    const code_challenger = btoa(str)
                                .replace(/=/g,'') //replace global '=' with ''
                                .replace(/\+/g,'-') //replace global '+' with '-'
                                .replace(/\//g,'_'); //replace global '/' with '_'
                                
    return code_challenger
}


//3. login using PKCE OAuth, runs from index.html, redirect to spotify login
async function auth_login() {
    const code_verifier = RandomString(64);
    window.localStorage.setItem("code_verifier", code_verifier);
    //store 'key' to persistent storage 

    const code_challenger = await sha256(code_verifier);
    console.log(code_challenger);
    


    //prepare authorization structure
    const url = new URL("https://accounts.spotify.com/authorize")

    const params = {
        response_type: 'code',
        client_id: CLIENT_ID,
        scope,
        code_challenge: code_challenger,
        code_challenge_method: "S256",
        redirect_uri: REDIRECT_URI,
    }

    url.search = new URLSearchParams(params).toString(); //builds the query string after ? in the url
    // https://accounts.spotify.com/en/authorize?response_type=code&client_id=a8ca54f3da924bcc8b...
    window.location.href = url.toString(); //redirects to auth page


    //RETRIEVE CODE FROM URL
}


//4. runs when redirected to compare.html, uses code verifier to exchange spotify code for access token
async function get_access_token() {


    const urlParams = new URLSearchParams(window.location.search); //reads the new URL
    let code = urlParams.get('code')

    // stored in the previous step
    const code_verifier = localStorage.getItem('code_verifier');

    const url = "https://accounts.spotify.com/api/token";
    const payload = {
        method: 'POST',
        headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: code_verifier,
        }),
    }

    const body = await fetch(url, payload);
    const response = await body.json();

    localStorage.setItem('access_token', response.access_token);


    // return response.access_token
    // const access_token = localStorage.getItem('access_token');
    // console.log('access_token: ',access_token)

}

//5. fetches playlist info
async function get_playlist(URL) {

    const access_token = localStorage.getItem('access_token');
    //NO ACCESS
    if (!access_token) {
        console.error("invalid access token")
        return;
    }


    const response = await fetch(`https://api.spotify.com/v1/playlists/${URL}`, 
                                        {method: 'GET',
                                        headers: {'Authorization':`Bearer ${access_token}`}}
                                );

    //INVALID PLAYLIST
    if (!response.ok) {
        console.error("Invalid URL",response.status)
        return;
    }

    const data = await response.json()
    return data;

}

//6. builds display list left/right
async function display_playlist(num) {
        let URL = document.getElementById(`URL${num}`).value.slice(-22);
        console.log(URL);
        
        const tracklist = document.getElementById(`playlist${num}tracks`);
        tracklist.innerHTML='';
        document.getElementById(`playlist${num}info`).style.visibility = 'visible'
        tracklist.style.visibility = 'visible'
        //clear list to prevent resubmission duplicates





        var data = await get_playlist(URL)




        if (!data) {
            document.getElementById(`playlist${num}info`).innerHTML = 'No Playlist found'
        }
        else {

            console.log(data.items);
            // data.items.next

            document.getElementById(`playlist${num}info`).innerHTML = `<div> Playlist Name: ${data.name} </div>
                                                                    <div> Owner: \t${data.owner.display_name} </div>`;

            console.log(data.items.items[0].item.name)
            console.log(data.items.items[0].item.artists[0].name)
            console.log(data.items.items[0].item.album.images)

            data = data.items //for parity
            var list = []; //preliminary check for same name using includes()
            let x=0;

            do {
                if (x>=1) { //triggers for >100
                    data = await get_playlist(`${URL}/items?offset=${x}00&limit=100`)
                    console.log("round",x,data.next)
                }

                for (let i=0;i<data.items.length;i++) {
                    list.push(data.items[i].item.name);
                    const li = document.createElement("li");
                    li.id = `playlist${num}-${data.items[i].item.name.replace(/\s/g, "_")}`
                    li.innerHTML = `<div class='item'>
                                        <img src=${data.items[i].item.album.images[2].url}> 
                                        <div class='text'>
                                            <div class='line1'>${data.items[i].item.name}</div>
                                            <div class='line2'>${data.items[i].item.artists[0].name}</div>
                                        </div>
                                    </div>`;
                    tracklist.append(li);
                } 
                x+=1;
            } while (data.items.next || data.next)

        }
        return list;

}


function clear_playlists() {
    const playlists = document.querySelectorAll('.tracks, .playlistinfo, .wrapper') //clears 3x info and 3x lists + venn
    playlists.forEach(playlist => {
        playlist.style.visibility = 'hidden';
    });
    return false; //change compared to false
}

// START OF CODE RUN
const CLIENT_ID = "a8ca54f3da924bcc8bd98dc113959823";
const REDIRECT_URI = "http://127.0.0.1:5500/compare.html"
const scope = "playlist-read-private playlist-read-collaborative user-top-read"


//redirect to login
if (document.getElementById("index")) {
    localStorage.clear();
    auth_login();
}


if (document.getElementById("compare")) {
    (async () => {

        if (localStorage.getItem('access_token') == null) {
            await get_access_token();
        }
        const access_token = localStorage.getItem('access_token');
        console.log('access_token: ',access_token)
    

        let list1 = null;
        let list2 = null;
        var compared = false;

        // listen for playlist url
        document.getElementById('playlist1').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (compared) {
                compared = clear_playlists();}

            list1 = await display_playlist('1');
            console.log(list1)
        });

        document.getElementById('playlist2').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (compared) {
                compared = clear_playlists();}
            
            list2 = await display_playlist('2');
            console.log(list2)
        });


        //compare
        document.querySelector('#compare').addEventListener('click', async (e) => {
            e.preventDefault();
            document.getElementById('compareinfo').style.visibility = 'visible'
            

            if (!list1 || !list2) {
                document.getElementById("compareinfo").innerHTML = " <div> Playlists not loaded </div>"
            }


            else if (!compared) { //no reaction if compared
                    console.log("starting compare")
                    document.getElementById("compareinfo").innerHTML = "<div> Repeated Tracks </div>"
                    const dupelist = document.getElementById('duplicatetracks')
                    dupelist.style.visibility = 'visible';

                    const list1length = list1.length
                    const list2length = list2.length 
                    let duplicates = 0;


                    for (let i=0;i<list1.length;i++) {
                        if (list2.includes(list1[i])) {
                            const dupe1 = document.getElementById(`playlist1-${list1[i].replace(/\s/g,'_')}`)
                            const dupe2 = document.getElementById(`playlist2-${list1[i].replace(/\s/g,'_')}`)
                            console.log(dupe1.querySelector('.line2'),dupe2.querySelector('.line2'))

                            if (dupe1.querySelector('.line2').innerHTML == dupe2.querySelector('.line2').innerHTML) { //final check if artist is the same

                                dupelist.append(dupe1) //this moves the entire element across not copy
                                // dupe1.remove()
                                dupe2.remove()
                                duplicates+=1;
                            }
                        }
                    }
                    compared=true;
                    console.log("setting compared to true")

                    document.querySelector(".wrapper").style.visibility = 'visible'
                    document.querySelector(".left-label").innerHTML = `${list1length - duplicates} / ${list1length} <br> Unique tracks <br> ${Math.round((list1length - duplicates)*100/list1length)}%`
                    document.querySelector(".right-label").innerHTML = `${list2length - duplicates} / ${list2length} <br> Unique tracks <br> ${Math.round((list2length - duplicates)*100/list2length)}%`
                    document.querySelector(".overlap-label").innerHTML = `${duplicates}<br>Overlapping tracks`
                }
        });



    })();
    
}


//https://open.spotify.com/playlist/1dbgnQK4e9FjfN2xsg5Ysa (temp)
//https://open.spotify.com/playlist/1wST4XeLKGQ39xZiOQtVwF (whole)
//https://open.spotify.com/playlist/6rTaG9LafOrABbKEdIhjoQ (jc)
//https://open.spotify.com/playlist/37i9dQZF1EJyvM0vyfdgU8 (collab)
//https://open.spotify.com/playlist/2WTluzUn0R5elKO7GyxG7d (testpage)


