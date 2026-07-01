(function () {
  "use strict";

  /* =========================================================
     STICKY HEADER SHADOW ON SCROLL
     ========================================================= */
  var header = document.getElementById("siteHeader");

  function handleHeaderShadow() {
    if (window.scrollY > 12) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }
  window.addEventListener("scroll", handleHeaderShadow, { passive: true });
  handleHeaderShadow();

  /* =========================================================
     MOBILE NAV TOGGLE
     ========================================================= */
  var navToggle = document.getElementById("navToggle");
  var mainNav = document.getElementById("mainNav");

  function closeNav() {
    mainNav.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  navToggle.addEventListener("click", function () {
    var isOpen = mainNav.classList.toggle("open");
    navToggle.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  /* =========================================================
     REVEAL ON SCROLL (IntersectionObserver)
     ========================================================= */
  var revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  /* =========================================================
     TESTIMONIAL SLIDER
     ========================================================= */
  var track = document.getElementById("testimonialTrack");
  var cards = track
    ? Array.prototype.slice.call(track.querySelectorAll(".testimonial-card"))
    : [];
  var dotsWrap = document.getElementById("testimonialDots");
  var prevBtn = document.getElementById("testimonialPrev");
  var nextBtn = document.getElementById("testimonialNext");
  var currentIndex = 0;
  var autoPlayTimer = null;
  var AUTO_PLAY_MS = 6000;

  function renderDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    cards.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to testimonial " + (i + 1));
      if (i === currentIndex) dot.classList.add("active");
      dot.addEventListener("click", function () {
        goToSlide(i);
        restartAutoPlay();
      });
      dotsWrap.appendChild(dot);
    });
  }

  function goToSlide(index) {
    if (!cards.length) return;
    currentIndex = (index + cards.length) % cards.length;
    cards.forEach(function (card, i) {
      card.classList.toggle("active", i === currentIndex);
    });
    if (dotsWrap) {
      Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
        dot.classList.toggle("active", i === currentIndex);
      });
    }
  }

  function startAutoPlay() {
    if (cards.length <= 1) return;
    autoPlayTimer = setInterval(function () {
      goToSlide(currentIndex + 1);
    }, AUTO_PLAY_MS);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  function restartAutoPlay() {
    stopAutoPlay();
    startAutoPlay();
  }

  if (cards.length) {
    renderDots();
    goToSlide(0);
    startAutoPlay();

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goToSlide(currentIndex - 1);
        restartAutoPlay();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goToSlide(currentIndex + 1);
        restartAutoPlay();
      });
    }

    track.addEventListener("mouseenter", stopAutoPlay);
    track.addEventListener("mouseleave", startAutoPlay);
  }

  /* =========================================================
     GALLERY LIGHTBOX
     ========================================================= */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxCaption = document.getElementById("lightboxCaption");
  var lightboxClose = document.getElementById("lightboxClose");
  var galleryItems = document.querySelectorAll(".gallery-item");

  function openLightbox(item) {
    var img = item.querySelector("img");
    if (!img || !lightbox) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "";
    lightboxCaption.textContent = item.getAttribute("data-caption") || "";
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
  }

  galleryItems.forEach(function (item) {
    item.addEventListener("click", function () {
      openLightbox(item);
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  /* =========================================================
     BACK TO TOP BUTTON
     ========================================================= */
  var backToTop = document.getElementById("backToTop");

  function handleBackToTop() {
    if (window.scrollY > 500) {
      backToTop.classList.add("show");
    } else {
      backToTop.classList.remove("show");
    }
  }
  window.addEventListener("scroll", handleBackToTop, { passive: true });
  handleBackToTop();

  backToTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* =========================================================
     FOOTER YEAR
     ========================================================= */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
})();
