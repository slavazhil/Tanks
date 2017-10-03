"use strict";
var players = [];
var delay = 3; //steps
var my = {name:"", number:0};
var time = {then:0, now:0, passed:0};
var host = location.origin.replace(/^http/, 'ws');
var websocket = new WebSocket(host);
////////////////////////////////////////////////////////////////////////////////
// START ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function start() {
	my.name = document.getElementById("name").value;
	if (my.name.length <= 0 || my.name.length > 10) {return;}
	websocket.send(JSON.stringify({name : my.name}));
	document.getElementById("welcome").style.display = "none";
};
////////////////////////////////////////////////////////////////////////////////
// STOP ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
window.onblur = function(){
	location.reload();
};
////////////////////////////////////////////////////////////////////////////////
// WEBSOCKET ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
websocket.onopen = function() {
	//activate "Start" button
};

//Messages from the server
websocket.onmessage = function(data) {
	var packet = JSON.parse(data.data);

	if (packet.start) {
		my.number = packet.start.length - 1;
		for (var i = 0; i < packet.start.length; i++) {
			players.push(new Player(packet.start[i].name,
				                      packet.start[i].x,
															packet.start[i].y,
															packet.start[i].angle,
															packet.start[i].kills));
		}//for (var i = 0; i < packet.start.length; i++)
		players[my.number].snapshot();
		time.then = Date.now();
		frames();

	} else if (packet.add) {
		players.push(new Player(packet.add.name,
			                      packet.add.x,
														packet.add.y,
														packet.add.angle,
														packet.add.kills));

	} else if (packet.remove) {
		players.splice(packet.remove.number, 1);
		if (my.number > packet.remove.number) {my.number -= 1;}

	} else if (packet.error) {
		alert(packet.error);

	} else {
		var number = packet >>> 26;
		packet = packet << 6 >>> 6;
		if (number === my.number) {input.receive();}
		players[number].inputs.push(packet);
	}
};
////////////////////////////////////////////////////////////////////////////////
// FRAMES //////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function frames() {
	time.now = Date.now();
	time.passed += time.now - time.then;
	fps.add();
	physics();
	draw();
	time.then = time.now;
	window.requestAnimationFrame(frames);
};
////////////////////////////////////////////////////////////////////////////////
// PHYSICS /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function physics() {
	while (time.passed >= step) {
		time.passed -= step;
		input.process();

		for (var i = 0; i < players.length; i++) {
			if (i === my.number) {continue;}
			if (players[i].inputs.length >= delay) {players[i].buffering = false;}
			if (players[i].inputs.length === 0)    {players[i].buffering = true;}
			if (players[i].buffering) {continue;}

			do {
				players[i].update();
				players[i].move();
				players[i].inputs.shift();
				if (players[i].shooting) {
					var enemies = {};
					for (var b = 0; b < players.length; b++) {
						if (b === i) {continue;}
						enemies[b] = players[b];
					}
					players[i].shoot(enemies);
				}//if (players[i].shooting)
			} while (players[i].inputs.length > delay);
		}//for (var i = 0; i < players.length; i++)

		if (players[my.number].inputs.length >= delay) {players[my.number].buffering = false;}
		if (players[my.number].inputs.length === 0)    {players[my.number].buffering = true;}
		if (!players[my.number].buffering) {
			do {
				players[my.number].update(true);
				players[my.number].inputs.shift();
			} while (players[my.number].inputs.length > delay);
		}//if (!players[my.number].buffering)

	}//while (time.passed >= step)
};
////////////////////////////////////////////////////////////////////////////////
// INPUT ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var input = {
	now      : 0,
	saved    : 0,
	received : 0,
	max      : 64, // max players

	receive : function() {
		this.received += 1;
		ping.receive();
	},//receive

	process : function() {
		this.saved = this.now;
		if (this.received > this.max) {this.saved += (this.max << 26); this.received -= this.max;}
		else {this.saved += (this.received << 26); this.received -= this.received;}
		websocket.send(JSON.stringify(this.saved));
		ping.send();

		players[my.number].inputs.unshift(input.saved);
		players[my.number].move();
		players[my.number].inputs.shift();
		players[my.number].snapshot();
		if (players[my.number].shooting) {
			var enemies = {};
			for (var i = 0; i < players.length; i++) {
				if (i === my.number) {continue;}
				enemies[i] = players[i];
			}
			players[my.number].shoot(enemies);
		}//if (players[my.number].shooting)
	}//process
};

window.addEventListener("keydown", function(event) {
	if (event.keyCode === 38 || event.keyCode === 87)    {input.now |= flag.forward;}
	if (event.keyCode === 40 || event.keyCode === 83)    {input.now |= flag.backward;}
	if (event.keyCode === 37 || event.keyCode === 65)    {input.now |= flag.leftTurn;}
	if (event.keyCode === 39 || event.keyCode === 68)    {input.now |= flag.rightTurn;}
	if (event.keyCode === 82 && players[my.number].dead) {input.now |= flag.resurrect;}
}, false);

window.addEventListener("keyup", function(event) {
	if (event.keyCode === 38 || event.keyCode === 87) {input.now &= ~flag.forward;}
	if (event.keyCode === 40 || event.keyCode === 83) {input.now &= ~flag.backward;}
	if (event.keyCode === 37 || event.keyCode === 65) {input.now &= ~flag.leftTurn;}
	if (event.keyCode === 39 || event.keyCode === 68) {input.now &= ~flag.rightTurn;}
	if (event.keyCode === 82)                         {input.now &= ~flag.resurrect;}
}, false);

window.onmousedown = function(event) {input.now |=  flag.shoot;};
window.onmouseup   = function(event) {input.now &= ~flag.shoot;};

window.onmousemove = function(event) {
	var dx = event.x - canvas.width/2;
	var dy = event.y - canvas.height/2;
	var angle = Math.atan2(dy, dx);               // -PI < 0 < PI
	//console.log(angle);
	if (angle < 0) {angle = 2 * Math.PI + angle;} // 0 < angle < 2PI
	var section = (512 * angle)/(2 * Math.PI);    // 0 < section < 512
	section = Math.round(section);                // round section
	input.now = input.now << 15 >>> 15;           // clear previous angle
	section = section << 23 >>> 6;                // shift new angle
	input.now += section;                         // save new angle
};
////////////////////////////////////////////////////////////////////////////////
// PING ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var ping = {
	values : [],
	sent   : [],

	send : function() {
		this.sent.push(Date.now());
	},

	receive : function() {
		this.values.push(Date.now() - this.sent[0]);
		this.sent.shift();
		if (this.values.length > 50) {this.values.shift();}
	},

	get : function() {
		if (this.values.length === 0) {return 0;}
		var sum = 0;
		for (var i = 0; i < this.values.length; i++) {sum += this.values[i];}
		return Math.round(sum/this.values.length);
	}
};
////////////////////////////////////////////////////////////////////////////////
// FPS /////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var fps = {
	values : [],

	add : function() {
		this.values.push(1000/(time.now - time.then));
		if (this.values.length > 20) {this.values.shift();}
	},

	get : function() {
		if (this.values.length === 0) {return 0;}
		var sum = 0;
		for (var i = 0; i < this.values.length; i++) {sum += this.values[i];}
		return Math.round(sum/this.values.length);
	}
};
////////////////////////////////////////////////////////////////////////////////
// DRAW ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", function(){
	canvas.width  = window.innerWidth;
	canvas.height = window.innerHeight;
}, false);

function draw() {
	if (players.length === 0) {return;}

	var camera = {
		x : canvas.width/2  - players[my.number].x,
		y : canvas.height/2 - players[my.number].y
	};

	//Reset
	ctx.fillStyle = "#eeeeee";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	//Arena
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(camera.x, camera.y, arena.width, arena.height);

	//Lines
	ctx.strokeStyle = "#eeeeee";
	for (var i = 50; i < arena.width; i += 50) {
		ctx.beginPath();
		ctx.moveTo(i+camera.x, 0+camera.y);
		ctx.lineTo(i+camera.x, arena.height+camera.y)
		ctx.stroke();
	}

	for (var i = 50; i < arena.height; i += 50) {
		ctx.beginPath();
		ctx.moveTo(0+camera.x, i+camera.y);
		ctx.lineTo(arena.width+camera.x, i+camera.y)
		ctx.stroke();
	}


	//Tanks
	for (var i = 0; i < players.length; i++) {
		ctx.strokeStyle = "#000000";

		var playerName = function() {
			if (players[i].buffering) {return "buffering";}
			else {return players[i].name + " ("+players[i].kills+")";}
		};
		ctx.save();
		ctx.translate(players[i].x + camera.x, players[i].y + camera.y);
		ctx.rotate(players[i].angle.base);

		//Front and Rear
		ctx.beginPath();
		ctx.moveTo(tank.width/2, -tank.height/2);
		ctx.lineTo(tank.width/1.5, 0);
		ctx.lineTo(tank.width/2,  tank.height/2);
		ctx.moveTo(-tank.width/2, -tank.height/2);
		ctx.lineTo(-tank.width/2,  tank.height/2);
		ctx.stroke();

		//Sides
		ctx.beginPath();
		ctx.lineWidth = 5;
		ctx.moveTo(-tank.width/2, -tank.height/2);
		ctx.lineTo( tank.width/2, -tank.height/2);
		ctx.moveTo(-tank.width/2,  tank.height/2);
		ctx.lineTo( tank.width/2,  tank.height/2);
		ctx.stroke();

		//Gun
		ctx.beginPath();
		ctx.rotate(players[i].angle.gun - players[i].angle.base);
		ctx.moveTo(0, 0);
		ctx.lineTo(tank.width, 0);
		ctx.stroke();

		ctx.restore();

		//Name
		ctx.fillStyle = "#000000";
		ctx.fillText(playerName(), players[i].x + camera.x - tank.width, players[i].y + camera.y - tank.height);

		//Dead
		if (players[i].dead) {
			ctx.save();
			ctx.translate(players[i].x + camera.x, players[i].y + camera.y);
			ctx.rotate(-Math.PI/4);
			ctx.font = "bold 25px Helvetica";
			ctx.fillStyle = "#FF4136";
			ctx.fillText("DEAD", 0 - tank.width, 0);
			ctx.restore();
		}

		//Bullets
		for (var b = 0; b < players[i].bullets.length; b++) {
			ctx.beginPath();
			ctx.strokeStyle = "rgba(0, 0, 0, " + players[i].bullets[b].fade + ")";
			ctx.moveTo(players[i].bullets[b].start.x + camera.x, players[i].bullets[b].start.y + camera.y);
			ctx.lineTo(players[i].bullets[b].end.x + camera.x, players[i].bullets[b].end.y + camera.y);
			ctx.stroke();
		}
		ctx.strokeStyle = "#000000"; //reset
	}

	//Info
	ctx.font = "15px Helvetica";
	ctx.fillText("Press R to resurrect", 15, 30);
	ctx.fillText("Ping: " + ping.get(), 15, 60);
	ctx.fillText("FPS: "  + fps.get(),  15, 90);

};

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
