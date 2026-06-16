// ================================================================
//  LELEMBUT SIDE-SCROLL — Engine v6
//  Features: 10+ Blocks, Decorations, Lighting Rework, Bug Fixes
// ================================================================
"use strict";

const INTERNAL_W = 1280, INTERNAL_H = 720;
let CW = INTERNAL_W, CH = INTERNAL_H;
let DRAW_SCALE = 1, DRAW_OFFSET_X = 0, DRAW_OFFSET_Y = 0;
let camZoom = 1, camZoomTarget = 1, zoomState = 0;
let camShake = 0;
const TS = 40;
let filmMode = false;
const FILM_BAR_H = 60;

let gameState = 'MENU'; 
let currentLevelId = null;
let isMapUnsaved = false;
let _baseCanvasFilter = 'none'; // stores user graphic filter (excl. grayscale)
let aimLock = 0; // -1: up, 1: down, 0: none
let aimMode = 'keyboard'; // 'keyboard' or 'mouse'
let mouseX = 0, mouseY = 0;
