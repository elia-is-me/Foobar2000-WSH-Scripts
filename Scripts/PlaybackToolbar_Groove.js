﻿// Required:
// * foobar2000 v1.3.3+
// * WSH Panel Mod Plus v1.5.7+
//
// Installation:
// * Import/paste the whole file content to wshmp's editor or
// * Use `PREPROCESSOR' to @import file like below.
//
// ==PREPROCESSOR==
// @author "lenka"
// @import "path\to\script.js"
// ==/PREPROCESSOR==

var shuffleType = window.GetProperty('shuffleType', 4);

// Check if foobar2000's shuffle type is different from script settings.
if (fb.PlaybackOrder > 3 && fb.PlaybackOrder !== shuffleType) {
  fb.PlaybackOrder = shuffleType;
  fb.trace('Playback order has been changed to scrips property setting.');
}

var REFRESH_INTERVAL = 15;

// Image.resize
var IMG_ADAPT = 0; // 适应
var IMG_CROP = 1; // 修剪
var IMG_STRETCH = 2; // 拉伸
var IMG_FILL = 3; // 填充

var DT_CENTER = 0x00000001;
var DT_VCENTER = 0x00000004;
var DT_CALCRECT = 0x00000400;
var DT_NOPREFIX = 0x00000800;
var DT_END_ELLIPSIS = 0x00008000;
var DT_LT = DT_CALCRECT | DT_NOPREFIX;
var DT_LC = DT_LT | DT_VCENTER | DT_END_ELLIPSIS
var DT_CC = DT_LT | DT_CENTER | DT_VCENTER | DT_END_ELLIPSIS;

// tf objects is recommended to be cached before use.
var TF_LENGTH = fb.TitleFormat('[%length%]');
var TF_TITLE = fb.TitleFormat('%title%');
var TF_ARTIST = fb.TitleFormat('[%artist%]');

var MK_SHIFT = 4;

var ww = 0;
var wh = 0;

var Mouse = {
  x: 0,
  y: 0
};

// Return a zoomed value, to adapt Windows zoom percent.
var scale = (function () {
  var objShell, tmp, factor;

  objShell = new ActiveXObject('WScript.Shell');
  tmp = objShell.RegRead('HKEY_CURRENT_USER\\Control Panel\\Desktop\\WindowMetrics\\AppliedDPI');
  factor = Math.round(tmp / 96 * 100) / 100;
  return function (value) {
    return Math.round(value * factor);
  };
}());

// helpers: // tool function ==================================================

var repaintAll = throttle(function () {
  window.Repaint();
}, REFRESH_INTERVAL);

var console = (function () {
  var debug = window.GetProperty('Debug', false);
  var log = function (str) {
    debug && fb.trace(str);
  };
  return {
    log: log
  };
})();

var getProperty = function (key, defVal, checkFunc) {
  var value = window.getProperty(key, defVal);
  if (checkFunc && checkFunc(value)) {
    return value;
  } else {
    return defVal;
  }
};

// Refer: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
function isArray (arg) {
  return Object.prototype.toString.call(arg) === '[object Array]';
}

// jQuery.isNumeric()
function isNumeric (obj) {
  return !isArray(obj) && (obj - parseFloat(obj) + 1) >= 0;
}

function isFunction (obj) {
  return Object.prototype.toString.call(obj) === '[object Function]';
}

function limit (num, a, b) {
  if (!isNumeric(num)) return num;
  if (num < a) num = a;
  if (num > b) num = b;
  return num;
}

// Used in `IGdiGraphics.DrawString`, set string alignment and etc.
function StringFormat(h, v, trimming, flags) {
    if (trimming === void 0) { trimming = 0; }
    if (flags === void 0) { flags = 0; }
    return (h << 28) | (v << 24) | (trimming << 20) | flags;
}

// color related

function rgba (r, g, b, a) {
  return ((a << 24) | (r << 16) | (g << 8) | (b));
}

function rgb (r, g, b) {
  return (0xff000000 | (r << 16) | (g << 8) | (b));
}

function setAlpha (color, a) {
  return ((color & 0x00ffffff) | (a << 24));
}

function pos2vol (pos) {
  return (50 * Math.log(0.99 * pos + 0.01) / Math.LN10);
}

function vol2pos (v) {
  return ((Math.pow(10, v / 50) - 0.01) / 0.99);
}

function debounce (fn, delay) {
  var timer = null;
  delay = delay || 250;
  return function () {
    var context = this,
      args = arguments;
    timer && window.ClearTimeout(timer);
    timer = window.SetTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}

function throttle (fn, threshhold, scope) {
  threshhold || (threshhold = 250);
  var last,
    deferTimer;
  return function () {
    var context = scope || this;

    var now = +new Date(),
      args = arguments;
    if (last && now < last + threshhold) {
      // hold on to it
      window.clearTimeout(deferTimer);
      deferTimer = window.setTimeout(function () {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}

function inherit (subClass, superClass) {
  var F = function () {};
  F.prototype = superClass.prototype;
  subClass.prototype = new F();
  subClass.prototype.constructor = subClass;

  subClass.superclass = superClass.prototype;
  if (superClass.prototype.constructor === Object.prototype.constructor) {
    superClass.prototype.constructor = superClass;
  }
}

function resizeImage (image, width, height, type, interpolation) {
  // Resize functions.
  var crop = function () {};
  var adapt = function () {};
  var stretch = function () {};
  var fill = function () {};
  var func = [adapt, crop, stretch, fill][type];

  return func(image, width, height, interpolation);
}

// Color
// ------

function getColor () {
  var color = {};
  color.bg = eval(window.GetProperty('Color background', 'rgb(16, 16, 16)').toLowerCase());
  color.fg = eval(window.GetProperty('Color text', 'rgb(235, 235, 235)').toLowerCase());

  return color;
}

var Color = getColor();

// Font
// -------

function getFonts () {
  var fontName = 'segoe ui semibold'; // semibold"
  var fontAssets = 'segoe mdl2 assets';
  var fontFallback = [fontName, 'tahoma'];
  var font = {};

  // Check if font (for text display) is installed.
  for (var i = 0, len = fontFallback.length; i < len; i++) {
    if (utils.CheckFont(fontFallback[i])) {
      font.Name = fontFallback[i];
      break;
    } else {
      fb.trace('Warning: ' + fontFallback[i] + ' is not installed');
    }
  }

  if (!utils.CheckFont(fontAssets)) {
    fb.trace('Warning: ' + fontAssets + ' is not installed');
  }

  var baseSize = 12;

  font.title = gdi.Font(font.Name, scale(baseSize + 2));
  font.time = font.small = gdi.Font(font.Name, scale(baseSize));
  if (font.Name.toLowerCase() !== font.title.Name.toLowerCase()) {
    fb.trace('Warning: failed to load font `' + fontName + "'");
    font.Name = font.title.Name;
  }
  font.AssetsName = fontAssets;

  return font;
}

var Font = getFonts();

// Create image resources.
// -----------------------

function getImages (_font, _color) {
  var sfCenter = StringFormat(1, 1);
  var fontAssets = gdi.Font(Font.AssetsName, scale(18));
  var images = {};
  var g;
  var btnW, nobW, coverW;

  // Convert icon char to image.
  function getImg (code, font, color, w, h) {
    var img = gdi.CreateImage(w, h);
    var gb = img.GetGraphics();
    var sf = StringFormat(1, 1);
    gb.SetTextRenderingHint(3);
    gb.DrawString(code, font, color, 0, 0, w, h, sf);
    gb.DrawString(code, font, color, 0, 0, w, h, sf);
    gb.SetTextRenderingHint(0);
    img.ReleaseGraphics(gb);
    return img;
  }

  var icons = {
    'prev': '\ue100',
    'pause': '\ue103',
    'play': '\ue102',
    'next': '\ue101',
    'volume': '\ue15d',
    'volumeMute': '\ue74f',
    'shuffle': '\ue14b',
    'repeat': '\ue149',
    'repeat1': '\ue1cc',
    'normal': '\ue13c',
    'close': '\ue711'
  };
  btnW = scale(40);
  for (var i in icons) {
    images[i] = getImg(icons[i], fontAssets, Color.fg, btnW, btnW);
  }

  var icons2 = {
    'volume1': '\ue993',
    'volume2': '\ue994',
    'volume3': '\ue995'
  };

  for (var j in icons2) {
    images[j] = gdi.CreateImage(btnW, btnW);
    g = images[j].GetGraphics();
    g.SetTextRenderingHint(3);
    g.DrawString(icons.volume, fontAssets, setAlpha(Color.fg, 64), 0, 0, btnW, btnW, sfCenter);
    g.DrawString(icons2[j], fontAssets, Color.fg, 0, 0, btnW, btnW, sfCenter);
    g.SetTextRenderingHint(0);
    images[j].ReleaseGraphics(g);
  }

  // Nocover image
  fontAssets = gdi.Font(Font.AssetsName, scale(40));
  coverW = scale(85);

  images.nocover = gdi.CreateImage(coverW, coverW);
  g = images.nocover.GetGraphics();
  g.FillSolidRect(0, 0, coverW, coverW, setAlpha(Color.fg, 20));
  g.SetTextRenderingHint(4);
  g.DrawString('\ue958', fontAssets, setAlpha(Color.fg, 128), 0, 0, coverW, coverW, sfCenter);
  g.SetTextRenderingHint(0);
  images.nocover.ReleaseGraphics(g);

  // Slider nob image
  nobW = scale(16);
  images.nob = gdi.CreateImage(nobW, nobW);
  g = images.nob.GetGraphics();
  g.SetSmoothingMode(2);
  g.DrawEllipse(scale(2), scale(2), nobW - scale(4), nobW - scale(4), scale(1), Color.fg);
  g.DrawEllipse(scale(2), scale(2), nobW - scale(4), nobW - scale(4), scale(1), Color.fg);
  g.SetSmoothingMode(0);
  images.nob.ReleaseGraphics(g);

  fontAssets.Dispose();

  return images;
}

var Images = getImages();

// Button && Buttons
// -----------------

var BUTTON_HOVER_ALPHA = 200;
var BUTTON_DOWN_ALPHA = 128;

function Button (img, func) {
  this.setImage(img);
  this.func = func;

  // state: 0 - normal, 1: hover, 2: down.
  this.state = 0;
  this.visible = true;
  this.enabled = false;
}

Button.prototype.trace = function (x, y) {
  var isMouseOver = x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
  return this.enabled && this.visible && isMouseOver;
};
Button.prototype.repaint = repaintAll;

Button.prototype.setXY = function (x, y) {
  this.x = x;
  this.y = y;
  this.enabled = true;
};
Button.prototype.setImage = function (img) {
  this.img = img;
  try {
    this.w = img.width;
    this.h = img.height;
  } catch (e) {
    throw new Error('Error: Invalid button image. ' + e);
  }
};

Button.prototype.setState = function (state) {
  if (state === this.state) return;
  this.state = state;
  this.repaint();
};

Button.prototype.draw = function (gr) {
  if (!this.visible || !this.enabled) return;
  var alpha = (this.state === 2 ? BUTTON_DOWN_ALPHA : this.state === 1 ? BUTTON_HOVER_ALPHA : 255);
  var img = this.img;
  gr.DrawImage(img, this.x, this.y, img.Width, img.Height, 0, 0, img.Width, img.Height, 0, alpha);
};

var ButtonsHandler = function (btns) {
  this.hbtn = null;
  this.dbtn = null;
  this.btns = [];
  this.set(btns);
};

ButtonsHandler.prototype.set = function (btns) {
  if (isArray(btns)) {
    this.btns = btns;
  } else {
    this.btns = [];
    for (var key in btns) {
      this.btns.push(btns[key]);
    }
  }
  this.length = this.btns.length;
};

ButtonsHandler.prototype.add = function (btns) {
  if (btns == null) return;
  if (isArray(btns)) {
    this.btns = this.btns.concat(btns);
  } else {
    for (var id in btns) {
      this.btns.push(btns[id]);
    }
  }
  this.length = this.btns.length;
};

ButtonsHandler.prototype.onMouseMove = function (x, y) {
  if (this.dbtn != null) {
    return;
  }
  if (this.hbtn && this.hbtn.trace(x, y)) {
    this.hbtn.setState(1);
    return;
  }

  var btn, len, i;

  for (i = 0, len = this.btns.length; i < len; i++) {
    if (this.btns[i].trace(x, y)) {
      btn = this.btns[i];
      break;
    }
  }

  if (btn && this.hbtn !== btn) {
    this.hbtn && this.hbtn.setState(0);
    this.hbtn = btn;
    btn.setState(1);
  } else if (!btn && this.hbtn) {
    this.hbtn.setState(0);
    this.hbtn = null;
  }
};

ButtonsHandler.prototype.onMouseDown = function (x, y) {
  if (this.hbtn) {
    this.dbtn = this.hbtn;
    this.dbtn.setState(2);
    this.hbtn = null;
  }
};

ButtonsHandler.prototype.onMouseUp = function (x, y) {
  if (this.dbtn) {
    this.dbtn.trace(x, y) && this.dbtn.func && this.dbtn.func(x, y);
    this.dbtn.setState(0);
    this.dbtn = null;
  }
  this.onMouseMove(x, y);
};

ButtonsHandler.prototype.onMouseLeave = function () {
  if (!this.hbtn) return;
  this.hbtn.setState(0);
  this.hbtn = null;
};

ButtonsHandler.prototype.draw = function (gr) {
  for (var i = 0, len = this.length; i < len; i++) {
    this.btns[i].draw(gr);
  }
};

function getPlaybackOrderImage (order) {
  if (typeof order === 'undefined') {
    order = fb.PlaybackOrder;
  }
  var imgs = [
    Images.normal,
    Images.repeat,
    Images.repeat1,
    Images.shuffle
  ];
  return (order > 2 ? imgs[3] : imgs[order]);
}

function getPlayOrPauseImage () {
  if (!fb.IsPlaying || (fb.IsPlaying && fb.IsPaused)) {
    return Images.play;
  } else {
    return Images.pause;
  }
}

function getVolumeImage () {
  var imgs = [
    Images.volumeMute,
    Images.volume1,
    Images.volume2,
    Images.volume3
  ];
  var vol = vol2pos(fb.Volume);

  if (vol > 0.66) return imgs[3];
  if (vol > 0.33) return imgs[2];
  if (vol === 0) return imgs[0];
  return imgs[1];
}

function getButtons () {
  var Buttons = {};

  // get buttons
  Buttons.prev = new Button(Images.prev, onPrev);
  Buttons.next = new Button(Images.next, onNext);
  Buttons.playOrPause = new Button(getPlayOrPauseImage(), onPlayOrPause);
  Buttons.order = new Button(getPlaybackOrderImage(), onPlaybackOrder);
  Buttons.volume = new Button(getVolumeImage(), onVolume);
  var closeVol = Buttons.closeVolume = new Button(Images.close, onCloseVolume);

  closeVol.draw = function (gr) {
    if (!this.enabled || !this.visible) return;

    if (this.trace(Mouse.x, Mouse.y)) {
      // Draw close btn.
      var alpha = (this.state === 2 ? BUTTON_DOWN_ALPHA : this.state === 1 ? BUTTON_HOVER_ALPHA : 255);
      var img = this.img;
      gr.DrawImage(img, this.x, this.y, img.Width, img.Height, 0, 0, img.Width, img.Height, 0, alpha);
    } else {
      // Draw volume value.
      gr.GdiDrawText(parseInt(fb.Volume, 10) + 100, Font.title, Color.fg, this.x, this.y, this.w, this.h, DT_CC);
    }
  };

  function onPrev () {
    fb.Prev();
  }

  function onNext () {
    fb.Next();
  }

  function onPlayOrPause () {
    fb.PlayOrPause();
  }

  function onVolume () {
    if (VolumeBar.visible) {
      fb.VolumeMute();
    } else {
      toggleVolumeDisplay();
    }
  }

  function onCloseVolume () {
    toggleVolumeDisplay();
  }

  function onPlaybackOrder () {
    if (fb.PlaybackOrder < 2) {
      fb.PlaybackOrder += 1;
    } else if (fb.PlaybackOrder === 2) {
      fb.PlaybackOrder = shuffleType;
    } else {
      fb.PlaybackOrder = 0;
    }
  }

  return Buttons;
}

function toggleVolumeDisplay () {
  VolumeBar.visible = !VolumeBar.visible;
  Buttons.closeVolume.visible = VolumeBar.visible;
  if (VolumeBar.visible) {
    ButtonCollection.set([Buttons.volume, Buttons.closeVolume]);
  } else {
    ButtonCollection.set(Buttons);
  }
  ButtonCollection.add([CoverViewer]);
  on_size();
}

var Buttons = getButtons();
var ButtonCollection = new ButtonsHandler(Buttons);

// AlbumArt obj ===================================================

var AlbumArtId = {
  front: 0,
  back: 1,
  disc: 2,
  icon: 3,
  artist: 4
};

var AlbumArt = {
  timer: null,

  // Callback function recieve 3 params: metadb, art_id, image
  getAsync: function (metadb, artID, callback, options) {
    var embedded, force;
    if (options && typeof options === 'object') {
      embedded = options.embedded || false;
      force = options.force || false;
    }
    if (!metadb) {
      return null;
    }
    var img;
    window.SetTimeout(function () {
      if (embedded && metadb.Path.indexOf('://') === -1) {
        img = utils.GetAlbumArtEmbedded(metadb.RawPath, artID);
        if (!img && force) {
          for (var i in AlbumArtId) {
            if (AlbumArtId[i] === AlbumArtId.icon) continue; // do not load icon images
            img = utils.GetAlbumArtV2(metadb, AlbumArtId[i], false);
            if (img) break;
          }
        }
      } else {
        img = utils.GetAlbumArtV2(metadb, artID, false);
        // if force == true, try to search all type of album art before
        // got one.
        if (force && !img) {
          for (i in AlbumArtId) {
            if (AlbumArtId[i] === artID) continue;
            if (AlbumArtId[i] === AlbumArtId.icon) continue; // do not load icon images
            img = utils.GetAlbumArtV2(metadb, AlbumArtId[i], false);
            if (img) break;
          }
        }
      }
      callback && callback(metadb, artID, img);
      return null;
    }, 15);
  },
  download: function () {
    // TODO
  }
};

// Image module to process images =============================================

var Image = {
  loadAsync: function () {},

  clone: function (img) {
    if (!img) return null;
    return img.Clone(0, 0, img.Width, img.Height);
  },

  resize: function (img, w, h, aspect, interpolation) {
    if (!img) return null;

    var _w, _h, img_, scale;
    switch (aspect) {
      case IMG_ADAPT:
        scale = 0;
        if (Math.max(img.Width, img.Height) < Math.min(w, h)) {
          scale = 1;
        } else {
          scale = Math.min(w / img.Width, h / img.Height);
        }
        _w = Math.floor(scale * img.Width);
        _h = Math.floor(scale * img.Height);
        break;

      case IMG_CROP:
        scale = Math.max(w / img.Width, h / img.Height);
        _w = Math.ceil(scale * img.Width);
        _h = Math.ceil(scale * img.Height);

        if (_w > w) {
          img_ = img.Resize(_w, _h, interpolation);
          var _x = Math.floor((_w - w) / 2);
          _w = w;
          img = img_.Clone(_x, 0, _w, _h);
        }
        if (_h > h) {
          img_ = img.Resize(_w, _h, interpolation);
          var _y = Math.floor((_h - h) / 2);
          _h = h;
          img = img_.Clone(0, _y, _w, _h);
        }
        break;

      case IMG_STRETCH:
        _w = w;
        _h = h;
        break;

      case IMG_FILL:
        scale = Math.max(w / img.Width, h / img.Height);

        _w = Math.ceil(scale * img.Width);
        _h = Math.ceil(scale * img.Height);
        break;
    }

    return img.Resize(_w, _h, interpolation);
  },

  isValid: function (img) {
    return (typeof img === 'object' && 'applyAlpha' in img);
  },

  applyShadow: function (image, w, h, interpolation, padding) {
    if (!this.isValid(image)) {
      return null;
    }
    var img = image.Resize(w, h, interpolation);
    var g = null;

    var shadow = gdi.createImage(w + 2 * padding, h + 2 * padding);
    g = shadow.GetGraphics();
    g.SetSmoothingMode(2);
    g.drawRoundRect(padding, padding, w, h, 2, 2, 2, 0xff000000);
    shadow.ReleaseGraphics(g);
    shadow.BoxBlur(1, 2);

    var ret = gdi.createImage(w + 2 * padding, h + 2 * padding);
    g = ret.GetGraphics();
    g.DrawImage(shadow, 0, 0, shadow.Width, shadow.Height, 0, 0, shadow.Width, shadow.Height, 0, 128);
    g.DrawImage(img, padding, padding, img.Width, img.Height, 0, 0, img.Width, img.Height, 0, 255);
    g.DrawRect(padding, padding, w, h, 1, setAlpha(0xff000000, 64));
    ret.ReleaseGraphics(g);

    img.Dispose();
    shadow.Dispose();

    return ret;
  }

};

// Slider Class. seekbar, volumebar, etc.
// ---------------------------------------

function Slider (img, height, getpos, setpos) {
  this.img = img; // nob image
  this.height = height; // visual height
  this.getpos = isFunction(getpos) ? getpos : function () {};
  this.setpos = isFunction(setpos) ? setpos : function () { return -1; };
  this.drag = false;

  this.pos = this.getpos();
  this.dragpos = 0;
  this.visible = true;
  this.enabled = false;
}

Slider.prototype.trace = function (x, y) {
  var halfW = (this.img ? (this.img.Width / 2) | 0 + 1 : 0);
  var isMouseOver = (x > this.x - halfW && x < this.x + this.w + halfW && y > this.y && y < this.y + this.h);
  return this.visible && isMouseOver;
};

Slider.prototype.repaint = repaintAll;

Slider.prototype.draw = function (gr) {
  if (!this.visible || !this.enabled || this.height > this.h || this.w <= 0) return;

  if (this.img) {
    this.drawWithNobImage(gr);
  } else {
    this.drawWithoutNobImage(gr);
  }
};

Slider.prototype.drawWithNobImage = function (gr) {
  if (!this.img) {
    this.drawWithoutNobImage(gr);
    return;
  }

  var offsetY = Math.round((this.h - this.height) / 2);
  var img = this.img;
  var imgX = this.x + this.w * (this.drag ? this.dragpos : this.pos) - img.width / 2;
  var imgY = (this.h - img.height) / 2 + this.y;

  // Draw nob image.
  gr.DrawImage(this.img, imgX, imgY, img.width, img.height, 0, 0, img.Width, img.Height, 0, 255);

  // Active progress bar bg.
  if (imgX - this.x > 0) {
    gr.FillSolidRect(this.x, this.y + offsetY, imgX - this.x, this.height, Color.fg);
  }

  // Inactive progress bar bg.
  if (this.x + this.w > imgX + img.width) {
    gr.FillSolidRect(imgX + img.width, this.y + offsetY, this.x + this.w - imgX - img.width, this.height, setAlpha(Color.fg, 128));
  }
};

Slider.prototype.drawWithoutNobImage = function (gr) {
  var offsetY = Math.round((this.h - this.height) / 2);

  // Inactive bg.
  gr.FillSolidRect(this.x, this.y + offsetY, this.w, this.height, setAlpha(Color.fg, 128));

  // Active bg.
  if (this.pos > 0) {
    gr.FillSolidRect(this.x, this.y + offsetY, this.w * this.pos, this.height, Color.fg);
  }
};

Slider.prototype.updateProgress = function () {
  this.pos = this.getpos();
};

Slider.prototype.setBounds = function (x, y, w, h) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  if (!this.visible) this.w = this.h = 0;
  this.enabled = true;
};

Slider.prototype.onMouseMove = function (x, y) {
  // Drag nob.
  if (this.visible && this.drag) {
    x -= this.x;
    this.dragpos = x < 0 ? 0 : x > this.w ? 1 : x / this.w;
    this.repaint();
  }
};

Slider.prototype.onMouseDown = function (x, y) {
  if (this.trace(x, y)) {
    this.drag = true;
    this.onMouseMove(x, y);
  }
};

Slider.prototype.onMouseUp = function (x, y) {
  if (this.drag) {
    this.pos = this.dragpos;
    this.setpos(this.dragpos);
    this.drag = false;
    this.repaint();
  }
};

// progressbar
// -------------

function getSeek () {
  var onGetProgress = function () {
    try {
      var pos = fb.PlaybackTime / fb.PlaybackLength;
      return isNumeric(pos) ? pos : 0;
    } catch (e) {
      return 0;
    }
  };

  var onSetProgress = function (pos) {
    try {
      fb.PlaybackTime = fb.PlaybackLength * pos;
    } catch (e) {}
  };

  return new Slider(Images.nob, scale(2), onGetProgress, onSetProgress);
}

// Nowplaying info button ======================================================

function CoverDisplay () {
  this.state = 0;
  this.func = null; // onClick function
  this.img = null; // displayed image of album art.
  this.imgcache = null; // raw image of album art.
  this.nocover = Images.nocover;
  this.visible = true;
  this.albumold = '#@!';

  // tf objects
  this.TF_TITLE = fb.TitleFormat('%title%');
  this.TF_ART = fb.TitleFormat('$if2([%artist%],' + 'Unknown Artist' + ')');
  this.TF_ART_ALB = fb.TitleFormat('%album artist%^^%album%');
}

inherit(CoverDisplay, Button);

var CoverViewer = new CoverDisplay();

ButtonCollection.add([ CoverViewer ]);

// Set NowPlaying on-click function
CoverViewer.func = function () {
  if (!fb.IsPlaying) return;

  fb.ActivePlaylist = fb.PlayingPlaylist;
  fb.RunMainMenuCommand('View/Show now playing in playlist');
};

CoverViewer.updateTitle = function (metadb) {
  if (!fb.IsPlaying) {
    this.trackTitle = '';
    this.trackArtist = '';
  } else {
    this.trackTitle = TF_TITLE.Eval();
    this.trackArtist = TF_ARTIST.Eval();
  }
};

// Exec it no matter album art is visible or not because we need to display
// blurred background.
CoverViewer.getAlbumArt = function (metadb) {
  var self = this;
  var albumKey;

  // Update title & artist.
  this.updateTitle();

  // callback
  this.onGetAlbumArt = function (metadb, artId, image) {
    // Cache image for other usage.
    self.imgcache = image;
    if (self.imgcache && self.h > 10) {
      self.img = Image.resize(self.imgcache, self.h, self.h, IMG_CROP, 3);
    }
    // Resize nocover image, should be exec only once.
    if (!self.nocover || self.nocover.Width !== self.h) {
      self.nocover = Images.nocover.Resize(self.h, self.h, 7);
    }
    self.repaint();
    Wallpaper.update();
  };

  // get on album switch
  if (metadb) {
    albumKey = this.TF_ART_ALB.EvalWithMetadb(metadb);
    if (albumKey !== this.albumold) {
      this.img = null;
      this.imgcache = null;
      AlbumArt.getAsync(metadb, AlbumArtId.front, this.onGetAlbumArt, { force: true });
      this.albumold = albumKey;
    }
  } else {
    this.imgcache = null;
    this.img = null;
  }

  // TODO: Release image resources by hands instead of CollectGarbadge()

  this.repaint();
};

CoverViewer.draw = function (gr) {
  if (!this.visible || !this.enabled) {
    return;
  }

  // Album art image (cover as default).
  if (this.img) {
    gr.DrawImage(this.img, this.x, this.y, this.h, this.h, 0, 0, this.img.Width, this.img.Height, 0, 225);
  } else {
    this.nocover && gr.DrawImage(this.nocover, this.x, this.y, this.h, this.h, 0, 0, this.nocover.Width, this.nocover.Height, 0, 255);
  }

  var pad = scale(10);

  // Album title & artist.
  gr.GdiDrawText(this.trackTitle, Font.title, Color.fg, this.x + this.h + pad, this.y, this.w - this.h - pad, this.h / 2, 0);
  gr.GdiDrawText(this.trackArtist, Font.small, Color.fg, this.x + this.h + pad, this.y + this.h / 2, this.w - this.h - pad, this.h / 2, 0);

  // hover color
  var overlay = this.state === 1 ? setAlpha(0xffffffff, 10) : setAlpha(0xffffffff, 20);
  this.state && gr.FillSolidRect(this.x, this.y, this.w, this.h, overlay);
};

CoverViewer.setBounds = function (x, y, w, h) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.enabled = true;
};

// Wallpaper ============================================================

var Wallpaper = {
  src: null,
  cache: null,
  timer: null,
  show: window.GetProperty('Wallpaper display', true),
  blur: window.GetProperty('Wallpaper blurred', true),
  // StackBlur param, (0 - 255).
  blurVal: window.GetProperty('Wallpaper blurred value', 45),
  alpha: window.GetProperty('Wallpaper alpha', 150),

  getImg: function (img) {
    if (!img) {
      return null;
    }
    img = Image.resize(img, ww, wh, IMG_FILL);
    if (this.blurVal < 0 || this.blurVal > 255) {
      this.blurVal = 45;
      window.SetProperty('Wallpaper blurred value', this.blurVal);
    }
    if (this.blur && this.blurVal > 0) {
      img.StackBlur(this.blurVal, 2);
    }
    var cutX = Math.round((img.Width - ww) / 2);
    try {
      return img.Clone(cutX, img.Height - wh - 5, ww, wh);
    } catch (e) {
      return null;
    }
  },

  update: function () {
    if (!this.show) return;
    this.cache = this.src;
    this.src = CoverViewer.imgcache ? this.getImg(CoverViewer.imgcache) : null;
    // var alpha = 0
    repaintAll();
  },

  onSize: debounce(function () {
    Wallpaper.update();
  }),

  draw: function (gr) {
    if (fb.IsPlaying && this.src && this.show) {
      gr.DrawImage(this.src, 0, 0, ww, wh, 0, 0, this.src.Width, this.src.Height, 0, 255);
      gr.FillSolidRect(0, 0, ww, wh, setAlpha(Color.bg, this.alpha));
    } else {
      gr.FillSolidRect(0, 0, ww, wh, Color.bg);
    }
  }

};

function lockPanelHeight (height) {
  window.Maxheight = window.MinHeight = height;
}

// on load =====================================================

lockPanelHeight(scale(60));

// Init obj
var SeekBar = getSeek();

SeekBar.updateTime = function () {
  if (fb.IsPlaying) {
    this.playbackTime = utils.FormatDuration(fb.PlaybackTime);
  } else {
    this.playbackTime = '';
  }
};

SeekBar.updateTitle = function () {
  if (fb.IsPlaying) {
    this.playbackLength = TF_LENGTH.Eval();
    this.title = TF_TITLE.Eval();
    this.artist = TF_ARTIST.Eval();
  } else {
    this.playbackLength = '';
    this.title = '';
    this.artist = '';
  }
};

var VolumeBar = (function () {
  function getVolume () {
    return vol2pos(fb.Volume);
  }

  function setVolume (pos) {
    fb.Volume = pos2vol(pos);
  }

  var V = new Slider(Images.nob, scale(2), getVolume, setVolume);

  V.onMouseWheel = function (step) {
    if (!V.visible) return;
    var pos = getVolume() * 100;
    pos += step * 5;
    setVolume(limit(pos / 100, 0, 1));
  };

  // Volumebar invisible on startup.
  V.visible = false;

  return V;
})();

if (fb.IsPlaying) {
  on_playback_new_track(fb.GetNowPlaying());
  on_playback_time(fb.PlaybackTime);
}

on_playback_edited();
on_playback_order_changed(fb.PlaybackOrder);

// callback functions ===============================================

function on_size () {
  ww = window.Width;
  wh = window.Height;
  if (!ww || !wh) return;

  Wallpaper.onSize();

  var pad = scale(10);
  var btnsW = Buttons.prev.w;
  var btnsY = Math.round((wh - btnsW) / 2);
  var firstBtn = VolumeBar.visible ? Buttons.volume : Buttons.prev;

  // Buttons Layout.
  if (VolumeBar.visible) {
    Buttons.volume.setXY(ww - btnsW * 4 - pad * 4, btnsY);
    Buttons.closeVolume.setXY(ww - btnsW - pad, btnsY);
  } else {
    Buttons.prev.setXY(ww - btnsW * 5 - pad * 5, btnsY);
    Buttons.playOrPause.setXY(ww - btnsW * 4 - pad * 4, btnsY);
    Buttons.next.setXY(ww - btnsW * 3 - pad * 3, btnsY);

    Buttons.volume.setXY(ww - btnsW - pad, btnsY);
    Buttons.order.setXY(ww - btnsW * 2 - pad * 2, btnsY);
  }

  // Cover
  var padCover = scale(10);
  var infoW = (ww > scale(840) ? scale(250) : scale(150));
  CoverViewer.visible = (firstBtn.x > wh - padCover + pad + infoW);
  CoverViewer.setBounds(padCover, padCover, wh - padCover * 2 + pad + infoW, wh - padCover * 2);

  // Seekbar
  var seekX = CoverViewer.x + CoverViewer.w + pad;
  var seekW = firstBtn.x - pad - pad - seekX;
  SeekBar.visible = seekW > scale(150);
  SeekBar.setBounds(seekX, (wh - scale(20)) / 2 - scale(10), seekW, scale(20));

  // VolumeBar
  var volX = firstBtn.x + firstBtn.w + pad;
  var volW = Buttons.closeVolume.x - volX - pad;
  VolumeBar.setBounds(volX, (wh - scale(20)) / 2, volW, scale(20));
}

function on_paint (gr) {
  // Background
  Wallpaper.draw(gr);

  // Buttons
  ButtonCollection.draw(gr);

  // Cover viewer
  CoverViewer.draw(gr);

  // Seekbar
  SeekBar.draw(gr);

  // Time & Length
  if (SeekBar.visible && fb.IsPlaying) {
    var durationW = gr.CalcTextWidth(SeekBar.playbackLength + '0', Font.time);
    gr.GdiDrawText(SeekBar.playbackLength, Font.time, Color.fg, SeekBar.x + SeekBar.w - durationW, (wh - 30) / 2 + 10, durationW, Font.time.Height, DT_LT);
    gr.GdiDrawText(SeekBar.playbackTime, Font.time, Color.fg, SeekBar.x, (wh - 30) / 2 + 10, durationW, Font.time.Height, DT_LT);
  }

  // Volumebar
  VolumeBar.draw(gr);
}

function on_mouse_move (x, y) {

  // Cache mouse cursor position.
  Mouse.x = x;
  Mouse.y = y;

  ButtonCollection.onMouseMove(x, y);
  SeekBar.onMouseMove(x, y);
  VolumeBar.onMouseMove(x, y);
}

function on_mouse_lbtn_down (x, y, mask) {
  ButtonCollection.onMouseDown(x, y);
  fb.IsPlaying && SeekBar.onMouseDown(x, y);
  VolumeBar.onMouseDown(x, y);
}

function on_mouse_lbtn_up (x, y, mask) {
  ButtonCollection.onMouseUp(x, y);
  SeekBar.onMouseUp(x, y);
  VolumeBar.onMouseUp(x, y);
}

function on_mouse_rbtn_up (x, y, mask) {
  return mask !== MK_SHIFT;
}

function on_mouse_leave () {
  // Set mouse cursor position to (-1, -1)
  Mouse.x = -1;
  Mouse.y = -1;

  ButtonCollection.onMouseLeave();
}

function on_mouse_wheel (step) {
  VolumeBar.onMouseWheel(step);
}

function on_playback_edited (handlelist, fromhook) {
  CoverViewer.getAlbumArt(fb.GetNowPlaying());
}

function on_playback_new_track (metadb) {
  Buttons.playOrPause.setImage(getPlayOrPauseImage());
  SeekBar.updateTime();
  SeekBar.updateTitle();
  CoverViewer.getAlbumArt(fb.GetNowPlaying());
  repaintAll();
}

function on_playback_seek (time) {
  on_playback_time(time);
}

function on_playback_time (time) {
  SeekBar.updateTime();
  SeekBar.updateProgress();
  SeekBar.visible && repaintAll();
}

function on_playback_starting () {
  Buttons.playOrPause.setImage(getPlayOrPauseImage());
  SeekBar.updateProgress();
  repaintAll();
}

function on_playback_pause (state) {
  Buttons.playOrPause.setImage(getPlayOrPauseImage());
  repaintAll();
}

function on_playback_stop (reason) {
  if (reason !== 2) {
    Buttons.playOrPause.setImage(getPlayOrPauseImage());
  }
  CoverViewer.albumold = '#@!';
  CoverViewer.getAlbumArt(fb.GetNowPlaying());
  SeekBar.updateProgress();
  SeekBar.updateTitle();
  SeekBar.updateTime();
}

function on_playback_order_changed (newOrder) {
  Buttons.order.setImage(getPlaybackOrderImage());
  repaintAll();
}

function on_volume_change (val) {
  VolumeBar.updateProgress();
  Buttons.volume.setImage(getVolumeImage());
  repaintAll();
}
