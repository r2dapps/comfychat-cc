const https = require('https');

function fetchPlaylist(listId) {
    return new Promise((resolve, reject) => {
        https.get(`https://www.youtube.com/playlist?list=${listId}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/var ytInitialData = (\{.*?\});<\/script>/);
                if (match) {
                    resolve(JSON.parse(match[1]));
                } else {
                    reject(new Error("ytInitialData not found"));
                }
            });
        }).on('error', reject);
    });
}

fetchPlaylist('PL__GQ-SJLZE_zZruVwNS8xSeK6xYPAdh5')
    .then(data => {
        let videos = [];
        
        function findLockups(obj) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach(findLockups);
                return;
            }
            if (obj.playlistVideoViewModel || obj.lockupViewModel) {
                const lockup = obj.playlistVideoViewModel || obj.lockupViewModel;
                const videoId = lockup.contentId || lockup.videoId;
                const title = lockup.title?.content || lockup.metadata?.lockupMetadataViewModel?.title?.content;
                
                // Get channel name
                let channel = "YouTube";
                try {
                    channel = lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content;
                } catch(e) {}
                
                // Get duration
                let duration = "";
                try {
                    duration = lockup.contentImage.thumbnailViewModel.overlays[0].thumbnailBottomOverlayViewModel.badges[0].thumbnailBadgeViewModel.text;
                } catch(e) {}

                // Get thumbnail
                let thumbnail = "";
                try {
                    const sources = lockup.contentImage.thumbnailViewModel.image.sources;
                    thumbnail = sources[sources.length - 1].url;
                } catch(e) {}

                if (videoId && title) {
                    videos.push({
                        id: videoId,
                        title: title,
                        channel: channel,
                        duration: duration,
                        thumbnail: thumbnail
                    });
                }
            }
            Object.values(obj).forEach(findLockups);
        }
        
        findLockups(data);
        console.log(`Successfully parsed ${videos.length} videos`);
        if (videos.length > 0) {
            console.log("First video:", videos[0]);
        }
    })
    .catch(console.error);
