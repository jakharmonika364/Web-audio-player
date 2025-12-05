export default class AudioController {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.analyser = this.audioContext.createAnalyser();
        this.source = null;
        
        this.analyser.fftSize = 2048;
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.isPlaying = false;
        this.currentBuffer = null;
        this.startTime = 0;
        this.pauseTime = 0;
        this.duration = 0;
        this.isMuted = false;
        this.previousVolume = 1;
    }
   
    async load(arrayBuffer) {
        try {
            this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.duration = this.currentBuffer.duration;
            this.pauseTime = 0;
            this.eventBus.emit('AUDIO_LOADED', { duration: this.duration });
        } catch (error) {
            console.error('Error decoding audio data:', error);
        }
    }
   
    play(offset = 0) {
        if (!this.currentBuffer) return;

        if (this.isPlaying) {
            this.stop();
        }

        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.currentBuffer;
        this.source.connect(this.gainNode);

       
        const startOffset = offset || this.pauseTime;
        this.startTime = this.audioContext.currentTime - startOffset;

        this.source.start(0, startOffset);
        this.isPlaying = true;

        this.source.onended = () => {
            if (this.isPlaying && (this.audioContext.currentTime - this.startTime >= this.duration)) {
                this.isPlaying = false;
                this.pauseTime = 0;
                this.eventBus.emit('AUDIO_ENDED');
            }
        };

        this.eventBus.emit('PLAYBACK_STARTED');
    }

    pause() {
        if (!this.isPlaying) return;

        this.source.stop();
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.isPlaying = false;
        this.eventBus.emit('PLAYBACK_PAUSED');
    }

    seek(time) {
        if (!this.currentBuffer) return;

        const wasPlaying = this.isPlaying;
        if (this.isPlaying) {
            this.stop();
        }

        this.pauseTime = time;

        if (wasPlaying) {
            this.play(time);
        } else {
         
            this.eventBus.emit('SEEK_UPDATE', { time });
        }
    }

    stop() {
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                
            }
            this.source = null;
        }
        this.isPlaying = false;
    }

    reset() {
        this.stop();
        this.currentBuffer = null;
        this.duration = 0;
        this.startTime = 0;
        this.pauseTime = 0;
    }

    setVolume(value) {
        this.gainNode.gain.value = value;
        if (!this.isMuted) {
            this.previousVolume = value;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.previousVolume = this.gainNode.gain.value;
            this.gainNode.gain.value = 0;
        } else {
            this.gainNode.gain.value = this.previousVolume;
        }
        return this.isMuted;
    }

    getCurrentTime() {
        if (!this.isPlaying) return this.pauseTime;
        return Math.min(this.audioContext.currentTime - this.startTime, this.duration);
    }

    getAnalyserData(dataArray) {
        this.analyser.getByteFrequencyData(dataArray);
    }
}
