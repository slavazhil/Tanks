"use strict";
var step = 25; //ms
var tank  = {width:25,   height:25, radius:12.5};
var arena = {width:1000, height:1000};
var flag = {
	forward   : 1,
	backward  : 2,
	leftTurn  : 4,
	rightTurn : 8,
	shoot     : 16,
	resurrect : 32,
	kill      : 64, //only server can set
	dead      : 128 //only server can set
};
////////////////////////////////////////////////////////////////////////////////
// PLAYER //////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var Player = function (name, x, y, angle, kills) {
	this.step = 0; //current step
	this.last = 0; //last confirmed step
	this.x = x;
  this.y = y;
	this.name = name;
	this.kills = kills;
	this.angle = {base:angle, gun:0};
	this.speed = {move:200, rotate:Math.PI};

	this.shooting = false;
	this.shotStep  = 0;
	this.shotDelay = 20;
	this.shotRange = 200;
	this.bullets = [];

	this.dead = false;
	this.deadStep = 0;

	this.buffering = true;
	this.inputs = [];
	this.snapshots = [];
};
////////////////////////////////////////////////////////////////////////////////
// MOVE ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Player.prototype.move = function() {
	var input = this.inputs[0];
	this.step += 1;

	//Bullets
	for (var i = 0; i < this.bullets.length; i++) {
		this.bullets[i].fade -= 0.05;
		if (this.bullets[i].fade <= 0) {this.bullets.splice(i, 1);}
	}

	//Resurrect
	if ((input & flag.resurrect) && this.dead) {
		this.dead = false;
		return;
	}

	//Dead
	if (this.dead) {return;}

  //Moving
	var move = this.speed.move * step / 1000;
	var moveX = Math.cos(this.angle.base) * move;
	var moveY = Math.sin(this.angle.base) * move;

	if (input & flag.forward) {
		if (this.x - tank.width/2  + moveX >= 0 && this.x + tank.width/2  + moveX <= arena.width)  {this.x += moveX;}
		if (this.y - tank.height/2 + moveY >= 0 && this.y + tank.height/2 + moveY <= arena.height) {this.y += moveY;}
	}

	if (input & flag.backward) {
		if (this.x - tank.width/2  - moveX >= 0 && this.x + tank.width/2  - moveX <= arena.width)  {this.x -= moveX;}
		if (this.y - tank.height/2 - moveY >= 0 && this.y + tank.height/2 - moveY <= arena.height) {this.y -= moveY;}
	}

	//Rotate
	var rotate = this.speed.rotate * step / 1000;
	if (input & flag.leftTurn)  {this.angle.base -= rotate;}
	if (input & flag.rightTurn) {this.angle.base += rotate;}

	//Angle
	this.angle.gun = (input >>> 17) * (2 * Math.PI) / 512;
	if (this.angle.gun > Math.PI) {this.angle.gun -= (2 * Math.PI);}

	//Shooting
	if ((input & flag.shoot) && (this.step >= this.shotStep + this.shotDelay)) {
		this.shotStep = this.step;
		this.shooting = true;
  }
};
////////////////////////////////////////////////////////////////////////////////
// SHOOT ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Player.prototype.shoot = function(enemies) {
	this.shooting = false;

	//Check range
	for (var i in enemies) {
		if (enemies[i].dead) {delete enemies[i]; continue;}
		var rangeX = enemies[i].x - this.x;
  	var rangeY = enemies[i].y - this.y;
    var range = Math.sqrt(rangeX * rangeX + rangeY * rangeY);
    if (range > this.shotRange) {delete enemies[i];}
	}

  //Bullet
	this.bullets.unshift({
		start : {x:this.x, y:this.y},
		end   : {x:this.x, y:this.y},
		fade  : 1
	});

	var dx = Math.cos(this.angle.gun) * this.shotRange;
	var dy = Math.sin(this.angle.gun) * this.shotRange;
  var magnitude = Math.sqrt(dx * dx + dy * dy);
  var stepX = dx/magnitude;
  var stepY = dy/magnitude;

  //Bullet step
  for (var i = 0; i < this.shotRange; i++) {
    //Collision
		for (var q in enemies) {
			if (enemies[q].x - tank.radius <= this.bullets[0].end.x && enemies[q].x + tank.radius >= this.bullets[0].end.x
      &&  enemies[q].y - tank.radius <= this.bullets[0].end.y && enemies[q].y + tank.radius >= this.bullets[0].end.y) {
        return q;
      }
		}//for (var q in enemies)
		this.bullets[0].end.x += stepX;
		this.bullets[0].end.y += stepY;
  }//for (var i = 0; i < this.shotRange; i++)

  return false;
};
////////////////////////////////////////////////////////////////////////////////
// SNAPSHOT ////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Player.prototype.snapshot = function(counter) {
	var snapshot = {
		x       : this.x,
		y       : this.y,
		angle   : this.angle.base,
		dead    : this.dead,
		counter : counter
	};

	this.snapshots.unshift(snapshot)
	if (this.snapshots.length > 100) {this.snapshots.pop();}
};
////////////////////////////////////////////////////////////////////////////////
// UPDATE //////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Player.prototype.update = function(rewind) {
	var input = this.inputs[0];
	if (input & flag.kill) {this.kills += 1;}
	if (input & flag.dead) {
		this.dead = true;
		if (rewind) {
			var margin = this.step - this.last;
			if (this.snapshots[margin]) {
				this.x = this.snapshots[margin].x;
				this.y = this.snapshots[margin].y;
				this.angle.base = this.snapshots[margin].angle;
			}//if (this.snapshots[margin])
		}//if (rewind)
	}//if (input & flag.dead)
	this.last += 1;
};
////////////////////////////////////////////////////////////////////////////////
// EXPORT //////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
module.exports = Player;
