/**
 * Main JS file for Casper behaviours
 */

(function () {
  "use strict";

  var VIDEO_SELECTORS = [
    "iframe[src*='player.vimeo.com']",
    "iframe[src*='youtube.com']",
    "iframe[src*='youtube-nocookie.com']",
    "iframe[src*='kickstarter.com'][src*='video.html']",
    "object",
    "embed"
  ];

  function ensureFitVidsStyles() {
    if (document.getElementById("fit-vids-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "fit-vids-style";
    style.textContent = ".fluid-width-video-wrapper{width:100%;position:relative;padding:0;}.fluid-width-video-wrapper iframe,.fluid-width-video-wrapper object,.fluid-width-video-wrapper embed{position:absolute;top:0;left:0;width:100%;height:100%;}";
    document.head.appendChild(style);
  }

  function wrapResponsiveVideos(container) {
    var videos = container.querySelectorAll(VIDEO_SELECTORS.join(","));

    if (!videos.length) {
      return;
    }

    ensureFitVidsStyles();

    Array.prototype.forEach.call(videos, function (video) {
      var tagName = video.tagName.toLowerCase();

      if (
        (tagName === "embed" && video.parentElement && video.parentElement.tagName.toLowerCase() === "object") ||
        (video.parentElement && video.parentElement.classList.contains("fluid-width-video-wrapper"))
      ) {
        return;
      }

      var height = parseInt(video.getAttribute("height"), 10) || video.offsetHeight;
      var width = parseInt(video.getAttribute("width"), 10) || video.offsetWidth;

      if (!height || !width) {
        height = 9;
        width = 16;
      }

      if (!video.id) {
        video.id = "fitvid" + Math.floor(Math.random() * 999999);
      }

      var wrapper = document.createElement("div");
      wrapper.className = "fluid-width-video-wrapper";
      wrapper.style.paddingTop = ((height / width) * 100) + "%";

      video.parentNode.insertBefore(wrapper, video);
      wrapper.appendChild(video);
      video.removeAttribute("height");
      video.removeAttribute("width");
    });
  }

  function updateReadingTime(container) {
    var words = container.textContent.trim().split(/\s+/).filter(Boolean).length;
    var minutes = Math.round((words / 270));
    var readingTime = minutes > 0 ? minutes + " min" : "Less than a minute";
    var readingTimeTarget = container.querySelector(".post-reading-time");
    var wordCountTarget = container.querySelector(".post-word-count");

    if (readingTimeTarget) {
      readingTimeTarget.textContent = readingTime;
    }

    if (wordCountTarget) {
      wordCountTarget.textContent = words;
    }
  }

  function wrapImageCaptions(container) {
    var images = container.querySelectorAll("img[alt]");

    Array.prototype.forEach.call(images, function (image) {
      var alt = image.getAttribute("alt");

      if (!alt || image.classList.contains("emoji") || image.closest("figure.image")) {
        return;
      }

      var figure = document.createElement("figure");
      figure.className = "image";
      var caption = document.createElement("figcaption");
      caption.textContent = alt;

      image.parentNode.insertBefore(figure, image);
      figure.appendChild(image);
      figure.appendChild(caption);
    });
  }

  function updateHeaderImage() {
    var top = window.pageYOffset || document.documentElement.scrollTop;
    var images = document.querySelectorAll(".post-image-image, .teaserimage-image");

    if (top < 0 || top > 1500) {
      return;
    }

    Array.prototype.forEach.call(images, function (image) {
      image.style.transform = "translate3d(0px, " + (top / 3) + "px, 0px)";
      image.style.opacity = 1 - Math.max(top / 700, 0);
    });
  }

  function updatePostContentPadding() {
    var articleImage = document.querySelector(".article-image");
    var postContent = document.querySelector(".post-content");

    if (!articleImage || !postContent) {
      return;
    }

    postContent.style.paddingTop = articleImage.offsetHeight + "px";
  }

  function findAnchorTarget(hash) {
    if (!hash || hash === "#") {
      return null;
    }

    var id = decodeURIComponent(hash.slice(1));

    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  function handleAnchorClick(event) {
    var link = event.target.closest("a[href*='#']");

    if (!link || link.getAttribute("href") === "#") {
      return;
    }

    if (link.pathname.replace(/^\//, "") !== window.location.pathname.replace(/^\//, "") || link.hostname !== window.location.hostname) {
      return;
    }

    var target = findAnchorTarget(link.hash);

    if (!target) {
      return;
    }

    event.preventDefault();
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.pageYOffset,
      behavior: "smooth"
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var postContent = document.querySelector(".post-content");

    if (postContent) {
      wrapResponsiveVideos(postContent);
      updateReadingTime(postContent);
      wrapImageCaptions(postContent);
    }

    updateHeaderImage();
    updatePostContentPadding();

    window.addEventListener("scroll", updateHeaderImage);
    window.addEventListener("resize", updatePostContentPadding);
    document.addEventListener("click", handleAnchorClick);
  });
}());
