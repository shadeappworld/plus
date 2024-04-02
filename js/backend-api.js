"use strict";

dv.backend = {
    __host: undefined,
    __host_init: async () => {
        if(!dv.backend.__host){
            dv.backend.__host = (await dv.storage.conf.get("video-host")) || "https://pipedapi.kavin.rocks";
        };
    },
    __get_fetch_policy: (reload) => {
        if(reload){
            return "reload";
        }
        return "force-cache";
    },
    __get_region: () => {
        return navigator.language.slice(-2).toUpperCase();
    },
    __get_unproxied_playback_url: (old_url) => {
        let url_object=new URL(old_url);
        return old_url.replace(url_object.host, url_object.searchParams.get("host"));
    },
    network_saving: false,
    get_trending_videos: async (reload = false) => {
        await dv.backend.__host_init();
        let tp_resource = await fetch(dv.backend.__host+"/trending?region="+dv.backend.__get_region(), { cache: dv.backend.__get_fetch_policy(reload) });
        console.log(tp_resource);
        let video_list = [];
        if(tp_resource.status == 200){
            let tp_video_list = await tp_resource.json();
            for(let video_index in tp_video_list){
                let tp_video = tp_video_list[video_index];
                if(tp_video.type != "stream") continue;

                let video = {
                    author: tp_video.uploaderName,
                    author_id: tp_video.uploaderUrl.replace("/channel/"),
                    author_thumbnail: tp_video.uploaderAvatar,
                    author_verified: tp_video.uploaderVerified,
                    description: tp_video.shortDescription,
                    duration: tp_video.duration,
                    live: tp_video.duration == -1 && tp_video.uploaded == -1,
                    title: tp_video.title,
                    id: tp_video.url.replace("/watch?v=", ""),
                    published: tp_video.uploaded / 1000,
                    views: tp_video.views,
                    thumbnail: tp_video.thumbnail
                };
                video_list.push(video);
            }
        } else {
            console.error(tp_resource.status);
        }
        return video_list;
    },
    get_video: async (id, reload = false) => {
        await dv.backend.__host_init();
        let tp_resource = await fetch(dv.backend.__host+"/streams/"+id);
        let video = {error:"#000"};
        if(tp_resource.status == 200){
            let tp_video = await tp_resource.json();
            video = {
                lastest: reload,
                author: tp_video.uploader,
                author_id: tp_video.uploaderUrl.replace("/channel/",""),
                author_thumbnail: tp_video.uploaderAvatar,
                author_verified: tp_video.uploaderVerified,
                author_followers: tp_video.uploaderSubscriberCount,
                category: tp_video.category,
                rating: {
                    allowed: true,
                    likes: tp_video.likes,
                    dislikes: tp_video.dislikes
                },
                duration: tp_video.duration,
                description: tp_video.description,
                live: tp_video.livestream,
                hls: tp_video.hls,
                published: tp_video.uploadDate,
                description: tp_video.description,
                title: tp_video.title,
                next_videos: [],
                id: id,
                subtitle_type: "ttml",
                subtitles: [],
                sources: {
                    video: [],
                    audio: []
                },
                views: tp_video.views,
                thumbnail: tp_video.thumbnailUrl
            };
            
            let asrcs = tp_video.audioStreams;
            let vsrcs = tp_video.videoStreams.filter(video => video.videoOnly);
            let subtitles = tp_video.subtitles;
            


            dv.backend.__audio = new Audio();
            dv.backend.__audio.addEventListener("error", e => {
                console.warn("Loading with proxy (It can not be loaded without proxy)")
                dv.backend.__audio.resolve(false);
            });
            dv.backend.__audio.addEventListener("canplay", e => {
                dv.backend.__audio.resolve(true);
            });
            let res_check = new Promise((resolve)=>{
                dv.backend.__audio.resolve = resolve;
            });
            dv.backend.__audio.src = dv.backend.__get_unproxied_playback_url(asrcs[0].url);

            let get_unproxied_playback_url = dv.backend.__get_unproxied_playback_url;
            if(!await res_check){
                get_unproxied_playback_url = e => e;
            }
            dv.backend.__audio.remove();


            for (let src_index in asrcs){
            	let src = asrcs[src_index];

            	video.sources.audio.push({
            		url: get_unproxied_playback_url(src.url),
            		quality: src.quality,
                    codec: src.codec,
                    bitrate: src.bitrate,
                    language_code: src.audioTrackLocale
            	});
            };

            for (let src_index in vsrcs){
            	let src = vsrcs[src_index];

            	video.sources.video.push({
            		url: get_unproxied_playback_url(src.url),
            		quality: src.quality,
                    codec: src.codec,
                    bitrate: src.bitrate,
                    fps: src.fps
            	});
            };

            for (let subtitle_index in subtitles){
            	let subtitle = subtitles[subtitle_index];
                if(subtitle.mimeType != "application/ttml+xml") continue;

            	video.subtitles.push({
            		url: subtitle.url,
                    name: dv.__get_language_from_code(subtitle.code) + ((subtitle.autoGenerated) ? " (Auto-Generated)" : ""),
                    language_code: subtitle.code
            	});
            }
            
            let next_videos = tp_video.relatedStreams;
            for(let next_video_index in next_videos){
                let next_video = next_videos[next_video_index];
                if(next_video.type != "stream") continue;
                video.next_videos.push({
                    author: next_video.uploaderName,
                    author_thumbnail: next_video.uploaderAvatar,
                    author_verified: next_video.uploaderVerified,
                    author_id: next_video.uploaderUrl.replace("/channel/", ""),
                    duration: next_video.duration,
                    published: next_video.uploadDate,
                    title: next_video.title,
                    id: next_video.url.replace("/watch?v=", ""),
                    views: next_video.views,
                    thumbnail: next_video.thumbnail
                });
            }
        } else {
            console.error(tp_resource.status);
        }
        return video;
    },
    get_video_comments: async (id, continuation=null) => {
        await dv.backend.__host_init();
    	let tp_resource = await fetch(
                                    dv.backend.__host + 
                                        ((continuation == null) ? "" : "/nextpage") +
                                            "/comments/" + id +
                                                ((continuation == null) ? "" : "?nextpage=" + encodeURIComponent(continuation)),
            { cache: "force-cache" });
    	let comments = {};
    	if(tp_resource.status == 200){
    		let tp_comments = await tp_resource.json();
    		comments = {
    			list: [],
    			continuation: tp_comments.nextpage,
    			disabled: tp_comments.disabled 
    		}
    		let tp_list = tp_comments.comments
    		for(let comment_index in tp_list){
    		let comment = tp_list[comment_index];
    			comments.list.push({
    				author: comment.author,
    				author_id: comment.commentorUrl.replace("/channel/",""),
    				author_thumbnail: comment.thumbnail,
    				author_verified: comment.verified,
    				content: comment.commentText,
                    continuation: comment.repliesPage,
    				hearted: comment.hearted,
    				pinned: comment.pinned,
    				likes: comment.likeCount,
    			});
    		}
    	} else {
    		console.error(tp_resource.status);
    	}
    	return comments;
    },
    search_videos: async (query) => {
        await dv.backend.__host_init();
    	let tp_resource = await fetch(dv.backend.__host+"/search?q="+encodeURIComponent(query)+"&filter=videos", { cache: "force-cache" });
 	    let video_list = [];
 	    if(tp_resource.status == 200){
 	        let tp_video_list = (await tp_resource.json()).items;
 	        for(let video_index=0; video_index < tp_video_list.length; video_index+=1){
                let video = tp_video_list[video_index];
                if(video.type != "stream") continue;
                video_list.push({
                    author: video.uploaderName,
                    author_id: video.uploaderUrl.replace("/channel/", ""),
                    author_thumbnail: video.uploaderAvatar,
                    author_verified: video.uploaderVerified,
                    duration: video.duration,
                    description: video.description,
                    live: video.duration == -1 && video.uploaded == -1,
                    title: video.title,
                    id: video.url.replace("/watch?v=", ""),
                    published: video.uploaded / 1000,
                    upcoming: false,
                    views: video.views,
                    thumbnail: video.thumbnail
                });
            }
        } else {
            console.error(tp_resource.status);
 	    }
 	    return video_list;
    },
    get_author: async (query) => {
        await dv.backend.__host_init();
        let tp_resource = await fetch(dv.backend.__host+"/channel/"+encodeURIComponent(query), { cache: "force-cache" });
        let the_author = {};
        if(tp_resource.status == 200){
            let tp_author = await tp_resource.json();
            the_author = {
                name: tp_author.name,
                thumbnail: tp_author.avatarUrl,
                banner: tp_author.bannerUrl,
                description: tp_author.description,
                followers: tp_author.subscriberCount,
                verified: tp_author.verified,
                videos: []
            };

            let their_videos = tp_author.relatedStreams;
            for(let the_video_index in their_videos){
                let the_video = their_videos[the_video_index];
                if(the_video.type != "stream") continue;
                the_author.videos.push({
                    author: the_video.uploaderName,
                    author_thumbnail: the_video.uploaderAvatar || tp_author.avatarUrl,
                    author_verified: the_video.uploaderVerified,
                    author_id: the_video.uploaderUrl.replace("/channel/", ""),
                    duration: the_video.duration,
                    published: the_video.uploaded / 1000,
                    title: the_video.title,
                    id: the_video.url.replace("/watch?v=", ""),
                    views: the_video.views,
                    thumbnail: the_video.thumbnail
                });
            };
        } else {
            console.error(tp_resource.status);
        };
        return the_author;
    },
    get_random_image: (width, height, topics) => {
    	return "https://source.unsplash.com/" + width + "x" + height + "/?" + topics;
    }
}
