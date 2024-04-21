"use strict";

var dv = {
    type: "player",
    response: {},
    video: null,
    audio: null,
    audio_only: false,
    volume_management: {
        set: (volume=100) => {
            dv.audio.volume = volume / 100;
            dv.video.volume = volume / 100;
            let volume_button = document.querySelector("button.volume");
            if(volume > 0 && volume_button.hasAttribute("true")) {
                volume_button.removeAttribute("true");
            };
        },
        get: () => {
            return dv.audio.volume * 100;
        }
    },
    embed: false,
    file_pointer: null,
    external_file: false,
    window_id: -1,
    trigger_close: true,
    history: [],
    controls: {
        play: () => {
            if(dv.video.paused){
                dv.video.play();
                if(dv.audio.getAttribute("src") != ""){
                    dv.audio.play();
                }
                dv.features.media_session.update();
                if ("mediaSession" in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                }
            } else {
                dv.video.pause();
                if(dv.audio.getAttribute("src") != ""){
                    dv.audio.pause();
                }
                if ("mediaSession" in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                }
            }
        },
        previous: () => {
            if(dv.history.length > 1) {
                let videos = dv.history.splice(-2);
                dv.render.player(videos[0]);
            }
        },
        next: () => {
            let next_video_id = dv.response.next_videos[
                Math.round(
                    Math.random() * (Math.min(3, dv.response.next_videos.length)-1)
                )
            ].id;
            dv.render.player(next_video_id);
        },
        update_volume: event => {
            dv.volume_management.set(event.target.value);
        },
        volume: event => {
            if(!event.target.hasAttribute("true")){
                event.target.setAttribute("true", true);
                event.target.setAttribute("old_value", dv.volume_management.get());
                dv.volume_management.set(0);
            } else {
                event.target.removeAttribute("true", true);
                dv.volume_management.set(event.target.getAttribute("old_value"));
            };
        },
        pip: () => {
            if(document.pictureInPictureElement){
                document.exitPictureInPicture();
            } else {
                dv.video.requestPictureInPicture();
            }
        },
        subtitle: async event => {
            if(event.target.value == -1){
                await dv.subtitles.close();
            } else {
                await dv.subtitles.load.ttml(dv.response.subtitles[event.target.value].url);
            }
        },
        videos: async event => {
            let old_time = dv.video.currentTime;
            dv.video.src = dv.response.sources.video[event.target.value].url;
            dv.video.currentTime = old_time;
        },
        audios: async event => {
            let player = dv[["video","audio"][Number(!dv.audio_only)]];
            let old_time = player.currentTime;
            player.src = dv.response.sources.audio[event.target.value].url;
            player.currentTime = old_time;
        },
        fullscreen: () => {
            if(!window.top.dv.gamepad?.initialized) {
                if(document.fullscreenElement){
                    document.exitFullscreen();
                    screen.orientation.unlock();
                } else {
                    document.body.requestFullscreen();
                    screen.orientation.lock('landscape');
                };
            } else {
                if(document.body.hasAttribute("embed-fullscreen")){
                    document.body.removeAttribute("embed-fullscreen");
                    dv.controller.leave_fullscreen();
                } else {
                    document.body.setAttribute("embed-fullscreen", true);
                    dv.controller.enter_fullscreen();
                }
            }
        },
        playrate: (e) => {
            dv.video.playbackRate = Number(e.target.value);
            dv.audio.playbackRate = Number(e.target.value);
        },
        time: {
            timer: null,
            ignore_change_event: false,
            update: () => {
                dv.controls.time.ignore_change_event = true;
                document.querySelector("input.time").value = dv.video.currentTime;
                if(!dv.audio_only && !!dv.audio.getAttribute("src") && Math.abs(dv.audio.currentTime-dv.video.currentTime) > 0.2){
                    if(navigator.userAgent.includes("Firefox")){
                        dv.video.currentTime = dv.audio.currentTime;
                    } else {
                        dv.audio.currentTime = dv.video.currentTime;
                    }
                };
            },
            update_duration: () => {
                document.querySelector("input.time").max = dv.video.duration;
            },
            update_current_time: (e) => {
                if(!dv.controls.time.ignore_change_event){
                    let new_time = document.querySelector("input.time").value;
                    dv.video.currentTime = new_time;
                    dv.audio.currentTime = new_time;
                } else {
                    dv.controls.time.ignore_change_event = false;
                }
            },
            start_timer : () => {
                dv.controls.time.stop_timer();
                dv.controls.time.timer = setInterval(dv.controls.time.update, 750);
            },
            stop_timer: () => {
                clearInterval(dv.controls.time.timer);
            }
        },
        audio_only: async () => {
            let the_time = dv.video.currentTime;
            dv.audio_only = !dv.audio_only;
            if(dv.audio_only){
                document.querySelector(".audio-only").setAttribute("true", true);
            } else {
                if(document.querySelector(".audio-only").hasAttribute("true"))
                    document.querySelector(".audio-only").removeAttribute("true");
            }
            await dv.render.player(dv.response.id);
            dv.video.currentTime = the_time;
        }
    },
    extended_controls: {
        update: {
            like: async (id) => {
                let like_button = document.querySelector(".extended-controls .like");
                if(await dv.storage.like.get(id, true)){
                    like_button.setAttribute("true", true);
                } else {
                    if(like_button.hasAttribute("true")){
                        like_button.removeAttribute("true");
                    };
                };
            }
        },
        share: async () => {
            let share_url = location.href.replace("&embed=true", "&embed=false");
            if("share" in navigator){
                await navigator.share({title:document.title, url:share_url})
            } else {
                await navigator.clipboard?.writeText(share_url);
            }
        },
        like: async (e) => {
            if(Object.keys(dv.response).length == 0) return;
            if(e.target.hasAttribute("true")){
                await dv.storage.like.set(dv.response.id, false);
            } else {
                await dv.storage.like.set(dv.response.id, true, {
                    title: dv.response.title,
                    author: dv.response.author,
                    thumbnail: await imageToBase64(dv.response.thumbnail),
                    liked_time: Date.now()/1000
                }); /* data:image/png;base64,(content) */
            };

            await dv.extended_controls.update.like(dv.response.id);
        }
    },
    render:{
        player: async (id) => {
            dv.subtitles.close();

            if(dv.response?.id != id) {
                dv.history = [...dv.history, id];
            };

            if(window.top.dv?.gamepad?.initialized){
                document.body.setAttribute("gamepad", true);
            }

            if(typeof(id) == "string"){ // if video backend
                dv.response = await dv.backend.get_video(id);
                
                dv.controller.title(dv.response.title);
                dv.video.src = "";
                dv.audio.src = "";
                document.querySelector("img.thumbnail").src = dv.response.thumbnail;

                let __add_option = (the_list, the_controller, clear = false, index) => {
                    if(clear){
                        the_controller.innerHTML = "";
                    }
                    for(let the_index in the_list){
                        let option = document.createElement("option");
                        option.selected = index == the_index;
                        option.value = the_index;
                        option.innerText = the_list[the_index];
                        the_controller.append(option);
                    };
                };
                let __get_video_quality = async (the_source) => {
                    let the_limit = Number(await dv.storage.conf.get("video-quality-limit"));
                    if(dv.network_saving) {
                        the_limit = Number(await dv.storage.conf.get("video-quality-limit-network-saving"));
                    }
                    return the_source.indexOf(the_source.filter(e=>e.match(/[0-9]+/g)[0]<=the_limit)[0]) || 0
                };
                let __get_audio_quality = async (the_source) => {
                    let the_limit = Number(await dv.storage.conf.get("audio-quality-limit"));
                    if(dv.network_saving) {
                        the_limit = Number(await dv.storage.conf.get("audio-quality-limit-network-saving"));
                    }
                    return the_source.indexOf(the_source.filter(e=>e.match(/[0-9]+/g)[0]<=the_limit)[0]) || 0
                };

                if(dv.response.live){
                    dv.video.volume = 1;
                    if(Hls.isSupported()) {
                        let hls = new Hls();
                        hls.loadSource(dv.response.hls);
                        hls.attachMedia(dv.video);
                        hls.on(Hls.Events.MANIFEST_PARSED, function() {
                            console.log("@Live");
                            video.play();
                        });
                    }
                } else {
                    let the_video_sources = dv.response.sources.video.map(element => element.quality+"@"+element.fps+" ("+element.codec+")");
                    let the_audio_sources = dv.response.sources.audio.map(
                        element => element.quality + ((element.language_code == null) ? "" : " - " + dv.__get_language_from_code(element.language_code)) + " ("+element.codec+")"
                    );
                    let the_video_source_index = await __get_video_quality(the_video_sources);
                    let the_audio_source_index = await __get_audio_quality(the_audio_sources);
                    if(!dv.audio_only) {
                        dv.video.volume = 0;
                        dv.video.src = dv.response.sources.video[the_video_source_index].url;
                        dv.audio.src = dv.response.sources.audio[the_audio_source_index].url;
                        __add_option(the_video_sources, document.querySelector(".videos").querySelector("select"), true, the_video_source_index);
                        __add_option(the_audio_sources, document.querySelector(".audios").querySelector("select"), true, the_audio_source_index);
                        if(document.body.hasAttribute("audio_only")){
                            document.body.removeAttribute("audio_only");
                        }
                    } else {
                        dv.video.volume = 1;
                        dv.video.src = dv.response.sources.audio[the_audio_source_index].url;
                        __add_option([], document.querySelector(".videos").querySelector("select"), true);
                        __add_option(the_audio_sources, document.querySelector(".audios").querySelector("select"), true, await the_audio_source_index);
                        if(!document.body.hasAttribute("audio_only")){
                            document.body.setAttribute("audio_only", true);
                        };
                    };
                };
                document.querySelector(".info div.name").innerText = dv.response.title;
                let div_author = document.querySelector(".info div.author");
                div_author.innerText = dv.response.author;
                if(dv.response.author_verified){
                    div_author.setAttribute("verified", true);
                } else {
                    if (div_author.hasAttribute("verified")){
                        div_author.removeAttribute("verified");
                    };
                };
                if(dv.response.next_videos.length > 0){
                    document.body.setAttribute("can_next", true);
                } else {
                    if (document.body.hasAttribute("can_next")){
                        document.body.removeAttribute("can_next");
                    };
                };
                if(dv.history.length > 1){
                    document.body.setAttribute("can_previous", true);
                } else {
                    if (document.body.hasAttribute("can_previous")){
                        document.body.removeAttribute("can_previous");
                    };
                };
                document.querySelector(".info img.author").src = dv.response.author_thumbnail;
                document.querySelector(".info div.followers").innerText = dv.response.author_followers + " Followers";
                dv.extended_controls.update.like(id);
                dv.features.media_session.metadata.title = dv.response.title;
                dv.features.media_session.metadata.artist = dv.response.author;
                if(dv.response.subtitles.length > 0) {
                    if(document.body.hasAttribute("no_subtitles")){
                        document.body.removeAttribute("no_subtitles");
                    };
                    let subtitle_controller = document.querySelector(".subtitles").querySelector("select");
                    subtitle_controller.innerHTML = "";
                    let option = document.createElement("option");
                    option.value = -1;
                    option.selected = true;
                    option.innerText = "None";
                    subtitle_controller.append(option);
                    let the_list = dv.response.subtitles.map((element)=>{return element.name});
                    __add_option(the_list, subtitle_controller);
                } else {
                    document.body.setAttribute("no_subtitles", true);
                };

                dv.render.list();
                dv.render.comments();
            } else { // if local

                // Create blob URL
                document.body.setAttribute("external_file", true);
                dv.file_pointer = id;
                let file = await id.getFile();
                let file_arraybuffer = await file.arrayBuffer();
                let file_blob = new Blob([file_arraybuffer], { type: 'application/octet-stream' });
                let file_url = URL.createObjectURL(file_blob);
                history.pushState({}, document.title, location.href+"&url="+file_url)

                dv.video.src = file_url; // blob
                let file_title = id.name.split(".")[0];
                dv.controller.title(file_title);
                document.querySelector(".info .name").innerText = file_title;
                document.querySelector(".info div.author").innerText = "Unknown";
                document.querySelector(".info img.author").src = "../assets/fluent-icons/person_16_regular.svg";
                document.querySelector(".info img.author").style.filter="invert(1)";
                dv.features.media_session.metadata.title = file_title;
                dv.features.media_session.metadata.artist = "Unknown";
            }
            dv.features.media_session.update();
        },
        list: () => {
            dv.broadcast.post({
                type: "list_update",
                wid: dv.window_id,
                list: dv.response.next_videos
            });
        },
        comments: () => {
            dv.broadcast.post({
                type: "comments_update",
                wid: dv.window_id,
                id: dv.response.id
            });
        }
    },
    visibility:{
        listener: () => {
            if(dv.audio_only) return;
            if(document.hidden){
                console.log("STATE: HIDDEN");
                //dv.video.pause();
                dv.controls.time.stop_timer();
            } else {
                console.log("STATE: SHOW");
                //dv.video.currentTime = dv.audio.currentTime;
                //dv.video.play();
                dv.controls.time.start_timer();
            }
        },
        register: () => {
            if(dv.mobile)
                document.addEventListener("visibilitychange", dv.visibility.listener);
        }
    },
    features: {
        better_fullscreen: () => {
            if (!!navigator.keyboard?.lock) {
                document.addEventListener('fullscreenchange', async () => {
                    if (document.fullscreenElement) {
                        await window.top.navigator.keyboard.lock(['Escape']);
                    } else {
                        await window.top.navigator.keyboard.unlock();
                    };
                });
            }
        },
        use_video_ratio: {
            timer: null,
            old_size: [0,0],
            listener: () => {
                if(dv.features.use_video_ratio.old_size[1] == window.outerHeight){
                    window.resizeTo(window.outerWidth, window.outerWidth / dv.video.videoWidth * dv.video.videoHeight);
                } else if (dv.features.use_video_ratio.old_size[0] == window.outerWidth) {
                    window.resizeTo(window.outerHeight / dv.video.videoHeight * dv.video.videoWidth, window.outerHeight);
                }
                dv.features.use_video_ratio.old_size = [window.outerWidth, window.outerHeight];
            },
            register: () => {
                if(dv.embed) return;
                
                dv.features.use_video_ratio.old_size = [window.outerWidth, window.outerHeight];
                window.onresize = () => {
                    clearTimeout(dv.features.use_video_ratio.timer);
                    dv.features.use_video_ratio.timer = setTimeout(dv.features.use_video_ratio.listener, 225);
                };
            }
        },
        next_video: () => {
            setTimeout(() => {
                if(dv.video.ended){
                    dv.controls.next();
                }
            }, 3000);
        },
        media_session: {
            register: () => {
                if ("mediaSession" in navigator) {
                    navigator.mediaSession.setActionHandler("play", dv.controls.play);
                    navigator.mediaSession.setActionHandler("pause", dv.controls.play);
                    navigator.mediaSession.setActionHandler('previoustrack', dv.controls.previous);
                    navigator.mediaSession.setActionHandler('nexttrack', dv.controls.next);
                }
            },
            metadata: {
                title: "Shade App Plus",
                artist: "Unknown"
            },
            update: () => {
                setTimeout(() => {
                    if ("mediaSession" in navigator) {
                        navigator.mediaSession.metadata = new MediaMetadata({});
                        navigator.mediaSession.metadata = new MediaMetadata({
                            title: dv.features.media_session.metadata.title,
                            artist: dv.features.media_session.metadata.artist
                        });
                    };
                }, 50);
            }
        },
        splited_playing: {
            screens: null,
            view_area: {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                width: 0,
                height: 0
            },
            screen: {},
            is_using: false,
            windows: [],
            init: async () => {
                if(dv.features.splited_playing.screens == undefined) {
                    if(await dv.storage.conf.get("use-custom-screen-config") == -1 
                        && "getScreenDetails" in window){
                            dv.features.splited_playing.screens = (await window.getScreenDetails()).screens;
                    } else {
                        let screen_conf = await dv.storage.conf.get("screen-config");
                        dv.features.splited_playing.screens = JSON.parse(screen_conf);
                    }
                }

                for(let the_screen_index = 0; the_screen_index < dv.features.splited_playing.screens.length; the_screen_index++){
                    let the_screen = dv.features.splited_playing.screens[the_screen_index];
                    if(the_screen_index == 0){
                        dv.features.splited_playing.screen = {
                            top: the_screen.top,
                            left: the_screen.left,
                            width: the_screen.width,
                            height: the_screen.height
                        };
                    }
                    if(the_screen.left < dv.features.splited_playing.view_area.left){
                        dv.features.splited_playing.view_area.left = the_screen.left;
                    }
                    if(the_screen.top < dv.features.splited_playing.view_area.top){
                        dv.features.splited_playing.view_area.top = the_screen.top
                    }
                    if(the_screen.left + the_screen.width > dv.features.splited_playing.view_area.right){
                        dv.features.splited_playing.view_area.right = the_screen.left + the_screen.width;
                        console.log(the_screen.left + the_screen.width);
                    }
                    if(the_screen.top + the_screen.height > dv.features.splited_playing.view_area.bottom){
                        dv.features.splited_playing.view_area.bottom = the_screen.top + the_screen.height;
                    }
                    dv.features.splited_playing.view_area.height = 
                        dv.features.splited_playing.view_area.bottom - dv.features.splited_playing.view_area.top;
                    dv.features.splited_playing.view_area.width = 
                        dv.features.splited_playing.view_area.right - dv.features.splited_playing.view_area.left;
                };

                for(let the_screen_index = 0; the_screen_index < dv.features.splited_playing.screens.length; the_screen_index++){
                    let the_screen = dv.features.splited_playing.screens[the_screen_index];
                    if(the_screen_index == 0){
                        dv.features.splited_playing.windows = [...dv.features.splited_playing.windows, window];
                    } else {
                        dv.features.splited_playing.windows = [...dv.features.splited_playing.windows, 
                            window.open("./splited_player.html?view="+the_screen_index, "_blank", "popup=yes")
                        ];
                    }
                };

                document.body.setAttribute("splited_playing", true);
                dv.features.splited_playing.is_using = true;
                let canvas = document.querySelector("canvas");
                canvas.width = dv.features.splited_playing.screen.width;
                canvas.height = dv.features.splited_playing.screen.height;
                dv.features.splited_playing.canvas_ctx = canvas.getContext('2d');
                setInterval(async ()=>{
                    if(dv.features.splited_playing.is_using){
                        dv.features.splited_playing.draw_scene();
                    }
                }, 1000 / await dv.storage.conf.get("splited-player-fps"));
            },
            canvas_ctx: null,
            draw_scene: async () => {
                dv.features.splited_playing.windows.forEach(the_window => {
                    the_window.dv.features.splited_playing.canvas_ctx.drawImage(
                        dv.video,
                        dv.video.videoWidth / dv.features.splited_playing.view_area.width * (the_window.dv.features.splited_playing.screen.left - dv.features.splited_playing.view_area.left),
                        dv.video.videoHeight / dv.features.splited_playing.view_area.height * (the_window.dv.features.splited_playing.screen.top - dv.features.splited_playing.view_area.top),
                        dv.video.videoWidth / dv.features.splited_playing.view_area.width * the_window.dv.features.splited_playing.screen.width,
                        dv.video.videoHeight / dv.features.splited_playing.view_area.height * the_window.dv.features.splited_playing.screen.height,
                        0,
                        0,
                        the_window.dv.features.splited_playing.screen.width,
                        the_window.dv.features.splited_playing.screen.height
                    );
                });
            }
        }
    },
    subtitles: {
        load: {
            ttml: async (url = dv.response.subtitles[0].url) => {
                await dv.subtitles.close();
                let subtitles = (new DOMParser()).parseFromString(
                    await (
                        await fetch(url, {cache:"force-cache"})
                        ).text(),
                    "application/xml");

                let texts = subtitles.querySelectorAll("*[begin][end]");
                let track = dv.video.addTextTrack("captions");
                track.mode = "showing";

                for(let text_index = 0; text_index < texts.length; text_index++){
                    let text = texts[text_index];
                    let nodes = text.childNodes;
                    let caption_text = "";
                    for(let node_index in nodes){
                        let the_node = nodes[node_index];
                        switch(the_node.nodeName){
                            case "#text":{
                                caption_text += the_node.nodeValue;
                                break;
                            } case "br": {
                                caption_text += "\n";
                                break;
                            }
                        }
                    }

                    let cue = new VTTCue(
                        dv.__parse_time(text.getAttribute("begin")),
                        dv.__parse_time(text.getAttribute("end")),
                        caption_text
                    );
                    cue.line = -4;
                    track.addCue(cue);
                };

            },
        },
        close: async () => {
            if (dv.video.textTracks.length > 0) {
                dv.video.textTracks[dv.video.textTracks.length-1].mode = "disabled";
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    let url_parameters = new URLSearchParams(window.location.search);
    dv.external_file = url_parameters.get("external_file") == "true";
    dv.window_id = url_parameters.get("wid");
    if(dv.window_id < 0){
        dv.window_id = Date.now();
    }
    dv.controller.init();
    let window_title = url_parameters.get("title");
    dv.controller.title(!!window_title ? window_title : "Unknown");

    if(url_parameters.get("embed") == "true"){
    	dv.embed = true;
    	document.body.setAttribute("embed", true);
    };

    if(dv.mobile) {
        document.body.setAttribute("mobile", true);
    }

    dv.broadcast.init();
    dv.visibility.register();
    dv.features.media_session.register();

    dv.audio = document.querySelector("audio");
    dv.audio.addEventListener("canplay", dv.features.media_session.update);
    dv.video = document.querySelector("video");
    dv.video.addEventListener("canplay", dv.features.media_session.update);
    dv.video.addEventListener("loadedmetadata", dv.controls.time.update_duration);
    dv.video.addEventListener("ended", dv.features.next_video);

    let controls = document.querySelector(".controls");
    
    // Play/Pause Button
    let play = controls.querySelector(".play");
    play.addEventListener("click", dv.controls.play);
    dv.video.addEventListener("play", (e, _play=play) => {
        _play.setAttribute("true", true);
        dv.controls.time.start_timer();
    });
    dv.video.addEventListener("pause", (e, _play=play) => {
        if(_play.hasAttribute("true")){
            _play.removeAttribute("true");
        }
        dv.controls.time.stop_timer();
    });
    
    // PiP button
    let pip = controls.querySelector(".pip");
    pip.addEventListener("click", dv.controls.pip);
    dv.video.addEventListener('leavepictureinpicture', (e, _pip=pip) => {
        if(_pip.hasAttribute("true")){
            _pip.removeAttribute("true");
        };
    });
    dv.video.addEventListener('enterpictureinpicture', (e, _pip=pip) => {
        _pip.setAttribute("true", true);
    });
    
    document.querySelector("input.time").addEventListener("input", dv.controls.time.update_current_time);
    document.querySelector("input.time").addEventListener("mousedown", dv.controls.time.update_current_time);
    document.querySelector("input.time").addEventListener("touchstart", dv.controls.time.update_current_time);
    document.querySelector("input.volume").addEventListener("input", dv.controls.update_volume);
    document.querySelector("input.volume").addEventListener("mousedown", dv.controls.update_volume);
    document.querySelector("input.volume").addEventListener("touchstart", dv.controls.update_volume);
    document.querySelector("button.volume").addEventListener("click", dv.controls.volume);
    controls.querySelector(".fullscreen").addEventListener("click", dv.controls.fullscreen);
    controls.querySelector(".splited-playing").addEventListener("click", dv.features.splited_playing.init);
    controls.querySelector(".playrate").querySelector("select").addEventListener("change", dv.controls.playrate);
    controls.querySelector(".subtitles").querySelector("select").addEventListener("change", dv.controls.subtitle);
    controls.querySelector(".videos").querySelector("select").addEventListener("change", dv.controls.videos);
    controls.querySelector(".audios").querySelector("select").addEventListener("change", dv.controls.audios);
    controls.querySelector(".audio-only").addEventListener("click", dv.controls.audio_only);
    controls.querySelector(".previous").addEventListener("click", dv.controls.previous);
    controls.querySelector(".next").addEventListener("click", dv.controls.next);
    document.querySelector(".info button.description").addEventListener("click", () => {
        dv.dialog.alert(dv.__get_text_content(dv.response.description));
    });

    (async () => {
        if(await dv.storage.conf.get("better-fullscreen") == 1){
            dv.features.better_fullscreen();
        }
    })();

    dv.features.use_video_ratio.register();

    window.addEventListener("unload", () => {
        if(dv.trigger_close){
            dv.broadcast.post({
                type: "player_close",
                wid: dv.window_id
            });
        };
    });

    if(!dv.embed) document.body.setAttribute("seperate", true);
    dv.apply_styles();
    
    // Video loading (from backend or local)
    
    let extended_controls = document.querySelector(".extended-controls");
    
    if(!dv.external_file) {
        extended_controls.querySelector(".like").addEventListener("click", dv.extended_controls.like);
        extended_controls.querySelector(".share").addEventListener("click", dv.extended_controls.share);
        extended_controls.querySelector(".list").addEventListener("click", () => { dv.open.list(); });
        extended_controls.querySelector(".comment").addEventListener("click", () => { dv.open.comments(); });
        
        dv.render.player(url_parameters.get("id"));
    } else {
        extended_controls.setAttribute("disabled", true);
        if("launchQueue" in window){
            window.launchQueue.setConsumer(
                async (handler) => {
                    dv.render.player(handler.files[0]);
                }
            );
        }; // else { load from the main (parent) window; };
    };
});
