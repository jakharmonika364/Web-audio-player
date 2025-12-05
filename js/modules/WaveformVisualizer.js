export default class WaveformVisualizer {
    constructor(canvasId, audioController) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.audioController = audioController;
        
        this.dataArray = new Uint8Array(this.audioController.analyser.frequencyBinCount);
        this.animationId = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    start() {
        if (!this.animationId) {
            this.draw();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    draw() {
        this.animationId = requestAnimationFrame(() => this.draw());

        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;
        

        this.audioController.getAnalyserData(this.dataArray);


        ctx.clearRect(0, 0, width, height);

      
        const color1 = '#a855f7'; // Purple
        const color2 = '#ec4899'; // Pink

        
        const dataLen = Math.floor(this.dataArray.length * 0.4);
        const centerX = width / 2;
        
        const sliceWidth = (width / 2) / dataLen;

        ctx.lineWidth = 2;
        ctx.strokeStyle = color1;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color1;

        ctx.beginPath();

        
        ctx.moveTo(0, height);

        
        for (let i = dataLen - 1; i >= 0; i--) {
            const value = this.dataArray[i];
            const percent = value / 255;
            const barHeight = percent * height * 0.9; 

            const x = centerX - (i * sliceWidth);
            const y = height - barHeight;

            ctx.lineTo(x, y);
        }

        
        for (let i = 0; i < dataLen; i++) {
            const value = this.dataArray[i];
            const percent = value / 255;
            const barHeight = percent * height * 0.9;

            const x = centerX + (i * sliceWidth);
            const y = height - barHeight;

            ctx.lineTo(x, y);
        }

        
        ctx.lineTo(width, height);


        ctx.lineTo(0, height);

        ctx.stroke();


        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0)'); // Bottom (transparent)
        gradient.addColorStop(0.4, 'rgba(168, 85, 247, 0.2)'); // Middle
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.6)'); // Top

        ctx.fillStyle = gradient;
        ctx.fill();
    }
}
