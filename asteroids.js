// taken from https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
function easeOutBack(t, s) {
    if (s == undefined) s = 1.70158;
    return (t=t-1)*t*((s+1)*t + s) + 1;
}

// base class of all renderable objects, handles hovering and clicking
class GameObject {
    constructor(game) {
        this.game = game;
        game.add(this);
    }

    destroy() {
        this.game.remove(this)
    }

    get BBox() {
        return null;
    }

    contains(pos) {
        if (this.BBox === null)
            return false;

        let {x, y} = pos;
        return x >= this.BBox.x && y >= this.BBox.y &&
               x <= this.BBox.x + this.BBox.width &&
               y <= this.BBox.y + this.BBox.height;
    }

    collides(obj) {
        if (obj.contains({x: this.BBox.x + this.BBox.width / 2, y: this.BBox.y}) ||
            obj.contains({x: this.BBox.x + this.BBox.width / 2, y: this.BBox.y + this.BBox.height}))
            return "y";
        if ((obj.contains({x: this.BBox.x, y: this.BBox.y}) &&
            obj.contains({x: this.BBox.x, y: this.BBox.y + this.BBox.height})) ||
            (obj.contains({x: this.BBox.x + this.BBox.width, y: this.BBox.y}) &&
            obj.contains({x: this.BBox.x + this.BBox.width, y: this.BBox.y + this.BBox.height})))
            return "x";
        if (obj.contains({x: this.BBox.x, y: this.BBox.y}) ||
            obj.contains({x: this.BBox.x + this.BBox.width, y: this.BBox.y}) ||
            obj.contains({x: this.BBox.x, y: this.BBox.y + this.BBox.height}) ||
            obj.contains({x: this.BBox.x + this.BBox.width, y: this.BBox.y + this.BBox.height}))
            return "y";

        // if ((this.BBox.x < obj.BBox.x + obj.BBox.width && this.BBox.x > obj.BBox.x) ||
        //     (this.BBox.x + this.BBox.width > obj.BBox.x && this.BBox.x + this.BBox.width < obj.BBox.x + obj.BBox.x))
        //     return "x";
        // if ((this.BBox.y < obj.BBox.y + obj.BBox.height && this.BBox.y > obj.BBox.y) ||
        //     (this.BBox.y + this.BBox.height > obj.BBox.y && this.BBox.y + this.BBox.height < obj.BBox.y + obj.BBox.y))
        //    return "y";
        return null;
    }

    sphereCol(obj) {
        let dist = (this.pos.x - obj.pos.x) * (this.pos.x - obj.pos.x) + (this.pos.y - obj.pos.y) * (this.pos.y - obj.pos.y);
        return (dist < (this.radius + obj.radius) * (this.radius + obj.radius));
    }

    get hovering() {
        return this.contains(this.game.mousePos);
    }

    click() {}

    update(ctx, delta) {}
}

class Particle extends GameObject {
    constructor(game, pos, speed, acc = {x: 0, y: 0}, color = "#fff", width = 3, lifetime = 800, trailLen = 5) {
        super(game);
        this.pos = Object.assign({}, pos);
        this.speed = Object.assign({}, speed);
        this.acc = acc;
        this.color = color;
        this.width = width;
        this.lifetime = lifetime;
        this.trailLen = trailLen;
        this.trail = [{...pos}];
        this.startTime = +new Date();
    }

    update(ctx, delta) {
        let l = (+new Date() - this.startTime) / this.lifetime;
        if (l > 1)
            return this.destroy();
        
        // this.speed.x *= 0.9;
        // this.speed.y *= 0.9;
        this.speed.x += this.acc.x;
        this.speed.y += this.acc.y;
        this.pos.x += this.speed.x * (1 - l) * delta / 100;
        this.pos.y += this.speed.y * (1 - l) * delta / 100;

        this.trail.unshift(Object.assign({}, this.pos));
        this.trail = this.trail.splice(0, this.trailLen);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width;
        for (let i = 1; i < this.trail.length; i++) {
            ctx.globalAlpha = (this.trailLen - i) / this.trailLen * (1 - l);
            
            ctx.beginPath();
            ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);        
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.stroke();    
        }
    }
}

class Asteroid extends GameObject {
    constructor(game, radius = null) {
        super(game);
        this.pos = {x: this.game.canvas.width * Math.random(), y: this.game.canvas.height * Math.random()};
        this.rot = 0;
        this.rotSpeed = (Math.random() - 0.5) / 100;
        if (radius === null)
            this.radius = Math.random() * 70 + 50;
        else
            this.radius = radius;
        this.speed = {
            x: (Math.random() - 0.5) * 30 * (100 / this.radius), 
            y: (Math.random() - 0.5) * 30 * (100 / this.radius)
        };

        this.polygon = [];
        for (var i = 0; i < 20; i++) {
            this.polygon.push({
                x: Math.sin(Math.PI * 2 * (i / 20)) * this.radius * (Math.random() * 0.25 + 0.9),
                y: Math.cos(Math.PI * 2 * (i / 20)) * this.radius * (Math.random() * 0.25 + 0.9),
            })
        }

        this.sound = new Audio("explosion.wav");
        this.sound.volume = 0.2;
    }

    get normSpeed() {
        let len = Math.hypot(this.speed.x, this.speed.y);
        return {
            x: this.speed.x / len,
            y: this.speed.y / len
        }
    }

    moveApart(asteroid) {
        while (this.sphereCol(asteroid)) {
            this.pos.x += this.speed.x / 5;
            this.pos.y += this.speed.y / 5;
            asteroid.pos.x += asteroid.speed.x / 5;
            asteroid.pos.y += asteroid.speed.y / 5;
        }
    }

    destroy() {
        super.destroy();        
        this.game.score += Math.round(this.radius);
        // this.brick_sound.play();
        this.game.asteroids.splice(this.game.asteroids.indexOf(this), 1);
        this.game.shake(50);

        for (var i = 0; i < this.radius; i++) {
            let ppos = {x: this.pos.x + (Math.random() - 0.5) * this.radius * 2, y: this.pos.y + (Math.random() - 0.5) * this.radius * 2};
            let pspeed = {x: this.speed.x + (Math.random() - 0.5) * 200, y: this.speed.y + (Math.random() - 0.5) * 200} 
            new Particle(this.game, ppos, pspeed, {x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5},
                         "hsl(" + (this.radius * 1.7 + 200) +  ", 100%, 55%)", 5, 1000, 20);
        }

        if (this.radius > 50) {
            let asteroid1 = new Asteroid(this.game, this.radius * (Math.random() / 3 + 0.33));
            asteroid1.pos = {x: this.pos.x, y: this.pos.y};

            let asteroid2 = new Asteroid(this.game, this.radius - asteroid1.radius);
            asteroid2.pos = {x: this.pos.x, y: this.pos.y};
            asteroid2.speed = {x: -asteroid1.speed.x, y: -asteroid1.speed.y};

            this.game.asteroids.push(asteroid1);
            this.game.asteroids.push(asteroid2);

            asteroid1.moveApart(asteroid2);
        }

        if (this.game.asteroids.length === 0) {
            this.game.ship.death_start = +new Date();
            this.game.ship.win_sound.play();
        }

        this.sound.play();
    }

    update(ctx, delta) {
        this.pos.x += this.speed.x * delta / 100;
        this.pos.y += this.speed.y * delta / 100;
        
        this.pos.x = (this.game.canvas.width + 3*this.radius + this.pos.x) % (this.game.canvas.width + 2*this.radius) - this.radius;
        this.pos.y = (this.game.canvas.height + 3*this.radius + this.pos.y) % (this.game.canvas.height + 2*this.radius) - this.radius;

        this.rot += this.rotSpeed;

        for (let asteroid of this.game.asteroids) {
            if (asteroid === this)
                continue;

            if (this.sphereCol(asteroid)) {
                let v1 = this.speed;
                let v2 = asteroid.speed;
                let x1 = this.pos;
                let x2 = asteroid.pos;
                let m1 = this.radius * this.radius;
                let m2 = asteroid.radius * asteroid.radius;
                let dist = (x1.x-x2.x)*(x1.x-x2.x) + (x1.y-x2.y)*(x1.y-x2.y);

                let dot1 = (v1.x-v2.x)*(x1.x-x2.x) + ((v1.y-v2.y)*(x1.y-x2.y));
                let s1 = {
                    x: v1.x - ((2*m2) / (m1+m2)) * (dot1 / dist) * (x1.x - x2.x),
                    y: v1.y - ((2*m2) / (m1+m2)) * (dot1 / dist) * (x1.y - x2.y),
                };

                let dot2 = (v2.x-v1.x)*(x2.x-x1.x) + ((v2.y-v1.y)*(x2.y-x1.y));
                let s2 = {
                    x: v2.x - ((2*m1) / (m1+m2)) * (dot2 / dist) * (x2.x - x1.x),
                    y: v2.y - ((2*m1) / (m1+m2)) * (dot2 / dist) * (x2.y - x1.y),
                };
                 
                // debugger;
                // console.log(s1, s2);

                this.speed = s1;
                asteroid.speed = s2;

                this.moveApart(asteroid);

                break;
            }
        }

        ctx.fillStyle = "hsl(" + (this.radius * 1.7 + 200) +  ", 100%, 45%)";
        ctx.strokeStyle = "hsl(" + (this.radius * 1.7 + 200) +  ", 100%, 70%)";
        ctx.shadowColor = "hsl(" + (this.radius * 1.7 + 200) +  ", 100%, 70%)";    
        ctx.lineCap = "round";        
        ctx.shadowBlur = 100;
        ctx.lineWidth = 7;
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rot);
        ctx.beginPath();
        ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
        for (let p of this.polygon) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(this.polygon[0].x, this.polygon[0].y);
        ctx.fill();
        ctx.stroke();
    }
}

class Laser extends GameObject {
    constructor(game, pos, speed, rot) {
        super(game);
        this.pos = Object.assign({}, pos);
        this.speed = Object.assign({}, speed);
        this.rot = rot;
        this.radius = 10;
    }

    update(ctx, delta) {
        this.pos.x += this.speed.x * delta / 100;
        this.pos.y += this.speed.y * delta / 100;

        if (this.pos.x < -10 || this.pos.x > this.game.canvas.width + 10 ||
            this.pos.y < -10 || this.pos.y > this.game.canvas.height + 10)
            this.destroy();

        if (Math.random() < 0.2) {
            new Particle(this.game, this.pos, {x: -this.speed.x / 10, y: -this.speed.y / 10}, {x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5});            
        }

        for (let asteroid of this.game.asteroids) {
            if (this.sphereCol(asteroid)) {
                asteroid.destroy();
                this.destroy();
                break;
            }
        }

        ctx.strokeStyle = "#fff";
        ctx.shadowColor = "rgb(255,255,255)";    
        ctx.shadowBlur = 100;
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.pos.x, this.pos.y);
        ctx.lineTo(this.pos.x - -Math.sin(this.rot) * 30, this.pos.y - Math.cos(this.rot) * 30);
        ctx.stroke();
    }
}

class Ship extends GameObject {
    constructor(game) {
        super(game);
        this.pos = {x: this.game.canvas.width / 2, y: this.game.canvas.height / 2};
        this.speed = {x: 0, y: 0};
        this.rot = Math.PI;
        this.cooldown = 0;
        this.warpCooldown = 0;
        this.radius = 30;
        this.shield = 3000;
        this.death_start = -1;     
        
        this.laser_sound = new Audio('laser.wav');
        this.laser_sound.volume = 0.3;
        this.death_sound = new Audio('death.wav');
        this.death_sound.volume = 0.5;
        this.win_sound = new Audio('win.wav');
        this.win_sound.volume = 0.5;
    }

    static draw(ctx, pos, rot) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-20, -10);
        ctx.lineTo(0, 30);
        ctx.lineTo(20, -10);
        ctx.fill();
        ctx.restore();
    }

    get BBox() {
        if (this.game.end)
            return {
                x: 900,
                y: 950,
                width: 250,
                height: 250,
            };

        return {
            x: this.pos.x - 10,
            y: this.pos.y - 10,
            width: 20,
            height: 20,
        }
    }

    click() {
        if (this.game.end)
            game = new Game(document.getElementById('canvas'));
        if (this.game.lives >= 0) {
            game.score = this.game.score;
            game.level = this.game.level + 1;
            game.lives += this.game.lives;

            for (var i = 0; i < this.game.level * 3; i++) {
                game.asteroids.push(new Asteroid(game));
            }
        }
    }

    update(ctx, delta) {
        if (this.death_start !== -1) {
            if (this.hovering)
                document.body.style.cursor = "pointer";
            return;
        }

        for (let asteroid of this.game.asteroids) {
            if (this.sphereCol(asteroid)) {
                asteroid.destroy();
                if (this.shield < 0) {
                    this.death_sound.play();                    
                    this.game.lives--;
                    this.game.shake(100);
                    for (var i = 0; i < 50; i++) {
                        let ppos = {x: this.pos.x + (Math.random() - 0.5) * 10, y: this.pos.y + (Math.random() - 0.5) * 10}        
                        let pspeed = {x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10};
                        new Particle(this.game, ppos, pspeed, {x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20}, "#fff", 4, 2000);
                    }
                    if (this.game.lives == -1) {
                        this.death_start = +new Date();
                        this.destroy();
                        this.game.gameObjects.push(this);
                    }
                    this.shield = 3000;
                }
            }
        }

        this.cooldown -= delta;
        this.warpCooldown -= delta;
        this.shield -= delta;

        if (this.game.pressed["ArrowLeft"] || this.game.pressed["a"])
            this.rot -= delta / 200;
        if (this.game.pressed["ArrowRight"] || this.game.pressed["d"])
            this.rot += delta / 200;
        if (this.game.pressed["ArrowUp"] || this.game.pressed["w"]) {
            this.speed.x -= Math.sin(this.rot) * delta / 50;
            this.speed.y += Math.cos(this.rot) * delta / 50;

            let ppos = {x: this.pos.x + (Math.random() - 0.5) * 10, y: this.pos.y + (Math.random() - 0.5) * 10}
            let pspeed = {
                x: Math.sin(this.rot) * 100 + (Math.random() - 0.5) * 20 + this.speed.x, 
                y: -Math.cos(this.rot) * 100 + (Math.random() - 0.5) * 20 + this.speed.y
            }
            new Particle(this.game, ppos, pspeed, {x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5});
        }
        if (this.game.pressed[" "] && this.cooldown <= 0) {
            let lspeed = {x: -Math.sin(this.rot) * 70 + this.speed.x, y: Math.cos(this.rot) * 70 + this.speed.y};
            new Laser(this.game, this.pos, lspeed, this.rot);
            this.laser_sound.play();
            for (var i = 0; i < 20; i++) {
                let ppos = {x: this.pos.x + (Math.random() - 0.5) * 10, y: this.pos.y + (Math.random() - 0.5) * 10}        
                new Particle(this.game, ppos, lspeed, {x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10}, "#fff", 3, 350);
            }
            this.game.shake(10);
            this.speed.x += Math.sin(this.rot) * 20;
            this.speed.y -= Math.cos(this.rot) * 20;
            this.cooldown = 1000;
        }
        if (this.game.pressed["v"] && this.warpCooldown <= 0) {
            this.pos.x = Math.random() * this.game.canvas.width;
            this.pos.y = Math.random() * this.game.canvas.height;
            this.warpCooldown = 1000;
        }


        this.pos.x += this.speed.x * delta / 100;
        this.pos.y += this.speed.y * delta / 100;

        this.pos.x = (this.game.canvas.width + 90 + this.pos.x) % (this.game.canvas.width + 60) - 30;
        this.pos.y = (this.game.canvas.height + 90 + this.pos.y) % (this.game.canvas.height + 60) - 30;
        
        ctx.shadowColor = "rgb(255,255,255)";    
        ctx.shadowBlur = Math.min(1000, 1000 - this.cooldown) / 20;
        ctx.fillStyle = "#fafafa";

        if (this.shield > 0) {
            ctx.beginPath();
            ctx.lineWidth = Math.pow((this.shield) / 500, 2);
            ctx.strokeStyle = "#fafafa";
            ctx.arc(this.pos.x, this.pos.y, 50, 0, Math.PI * 2);
            ctx.stroke();
        }

        Ship.draw(ctx, this.pos, this.rot);
    }
}


// handles the main game loop and mouse events, keeps and calls update for all GameObjects
class Game {
    constructor(element) {
        this.canvas = element;
        this.canvas.onmousemove = (event) => {this.mouseMove(event)};
        this.canvas.onmousedown = (event) => {this.click(event)};

        this.pressed = {};
        window.onkeydown = (event) => {this.pressed[event.key] = true;};
        window.onkeyup = (event) => {this.pressed[event.key] = false;};
        this.ctx = canvas.getContext('2d');

        this.gameObjects = [];
        this.toRemove = [];
        this.lastTime = +new Date();
        this.gameStart = +new Date();
        this.mousePos = {x: 0, y: 0};
        this.shakeMag = 0;

        this.lives = 3;
        this.score = 0;
        this.level = 0;

        this.asteroids = [];
        for (var i = 0; i < 10; i++) {
            this.asteroids.push(new Asteroid(this));        
        }

        this.ship = new Ship(this);        

        window.requestAnimationFrame(() => {this.render()});
    }

    get end() {
        return this.asteroids.length === 0 || this.lives < 0;
    }

    add(obj) {
        this.gameObjects.push(obj);
    }

    remove(obj) {
        this.toRemove.push(obj);
    }

    mouseMove(event) {
        let rect = this.canvas.getBoundingClientRect();
        let x = Math.floor((event.clientX - rect.left) / this.canvas.offsetWidth * this.canvas.width);
        let y = Math.floor((event.clientY - rect.top) / this.canvas.offsetHeight * this.canvas.height);
        this.mousePos = {x, y};
    }

    click(event) {
        this.mouseMove(event);
        for (let obj of this.gameObjects) {
            if (obj.hovering)
                obj.click();
        }
    }

    shake(magnitude) {
        this.shakeMag += magnitude;
    }

    render() {
        let ctx = this.ctx;
        
        // reset pointer
        document.body.style.cursor = "default";

        let delta = +new Date() - this.lastTime;
        this.lastTime = +new Date();

        this.ctx.save();
        this.shakeMag *= 0.95;
        this.ctx.translate(Math.random() * this.shakeMag, Math.random() * this.shakeMag);

        // update background
        this.ctx.fillStyle = '#212121';
        this.ctx.fillRect(-200, -200, this.canvas.width + 400, this.canvas.height + 400);

        for (let obj of this.gameObjects) {
            this.ctx.save()
            obj.update(this.ctx, delta);
            this.ctx.restore();
        }

        if (this.ship.death_start !== -1) {
            let death_time = +new Date() - this.ship.death_start;
            
            ctx.fillStyle = "#fafafa";
            ctx.shadowBlur = 50;
            ctx.beginPath();

            ctx.arc(this.ship.pos.x, this.ship.pos.y, Math.min(Math.pow(death_time / 20 + 5, 2), 10000), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = Math.max(Math.min((death_time - 500) / 2000, 1), 0);
            ctx.textAlign="center";
            ctx.fillStyle = "#212121";
            ctx.font = "500px FontAwesome";
            if (this.lives < 0)
                ctx.fillText('\uF00D', 1000, 600);
            else
                ctx.fillText('\uF091', 1000, 600);
            ctx.font = "200px FontAwesome";
            if (this.lives < 0)
                ctx.fillText('\uF021', 1000, 1150);
            else
                ctx.fillText('\uF061', 1000, 1150);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        // render ui
        this.ctx.textAlign = "center";
        if (!this.end)
            this.ctx.fillStyle = "#fafafa";

        let since_start = +new Date() - this.gameStart;
        if (since_start <= 5000) {
            this.ctx.globalAlpha = Math.pow((5000 - since_start) / 5000, 0.7);
            this.ctx.font = "45px FontAwesome";
            this.ctx.fillText('\uF062', this.canvas.width / 2, this.canvas.height / 2 - 100);
            this.ctx.fillText('\uF060                 \uF061', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText('\uF05B \uF096', this.canvas.width / 2, this.canvas.height / 2 + 120);
            
            this.ctx.fillText('\uF047', this.canvas.width / 2 - 23, this.canvas.height / 2 + 170);            
            this.ctx.font = "45px cliche";
            this.ctx.fillText('V', this.canvas.width / 2 + 25, this.canvas.height / 2 + 170);
            this.ctx.globalAlpha = 1;
        }

        for (let i = 0; i < this.lives; i++) {
            Ship.draw(this.ctx, {x: 60 + i * 60, y: 70}, Math.PI);
        }

        this.ctx.font = "45px FontAwesome";
        for (let i = 0; i < this.level; i++) {
            this.ctx.fillText('\uF061', this.canvas.width - 60 - i * 60, 75);
        }

        this.ctx.font = "45px cliche";
        this.ctx.fillText(this.score, this.canvas.width / 2, 75);
        this.ctx.restore();

        // remove destroyed objects
        for (let obj of this.toRemove) {
            this.gameObjects.splice(this.gameObjects.indexOf(obj), 1);        
        }
        this.toRemove = [];

        window.requestAnimationFrame(() => {this.render()});
    }
}

let game = new Game(document.getElementById('canvas'));