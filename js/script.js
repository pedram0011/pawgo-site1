(function () {
    "use strict";

    document.documentElement.classList.add("js");

    /* Sticky header shadow */
    var header = document.getElementById("siteHeader");
    function onScroll() {
        header.classList.toggle("is-scrolled", window.scrollY > 10);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* Mobile navigation */
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    function closeNav() {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
    }
    toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeNav();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeNav();
    });
    window.addEventListener("resize", function () {
        if (window.innerWidth > 1120) closeNav();
    });

    /* Reveal on scroll (progressive enhancement) */
    var reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && reveals.length) {
        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
        );
        reveals.forEach(function (el) {
            io.observe(el);
        });
    } else {
        reveals.forEach(function (el) {
            el.classList.add("is-visible");
        });
    }

    /* Gallery lightbox */
    var lightbox = document.getElementById("lightbox");
    if (lightbox) {
        var lbImg = document.getElementById("lightboxImg");
        var lbCap = document.getElementById("lightboxCaption");
        var lbClose = document.getElementById("lightboxClose");
        var lastFocus = null;

        function openLb(btn) {
            var img = btn.querySelector("img");
            if (!img) return;
            lastFocus = btn;
            lbImg.src = img.currentSrc || img.src;
            lbImg.alt = img.alt;
            lbCap.textContent = btn.getAttribute("data-caption") || "";
            lightbox.hidden = false;
            requestAnimationFrame(function () {
                lightbox.classList.add("is-open");
            });
            document.body.style.overflow = "hidden";
            lbClose.focus();
        }

        function closeLb() {
            lightbox.classList.remove("is-open");
            document.body.style.overflow = "";
            setTimeout(function () {
                if (!lightbox.classList.contains("is-open")) lightbox.hidden = true;
            }, 280);
            if (lastFocus) lastFocus.focus();
        }

        document.querySelectorAll("[data-lightbox]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                openLb(btn);
            });
        });
        lbClose.addEventListener("click", closeLb);
        lightbox.addEventListener("click", function (e) {
            if (e.target === lightbox) closeLb();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && lightbox.classList.contains("is-open")) closeLb();
        });
    }

    /* Footer year */
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    /* Contact form → opens the visitor's mail client with a composed message.
       No server-side endpoint is configured for this static site. */
    var form = document.getElementById("contactForm");
    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var data = new FormData(form);
            var subject =
                "Pawgo enquiry — " + (data.get("name") || "Website visitor");
            var body =
                "Name: " + (data.get("name") || "") + "\n" +
                "Email: " + (data.get("email") || "") + "\n" +
                "Pet: " + (data.get("pet") || "") + "\n\n" +
                (data.get("message") || "");
            window.location.href =
                "mailto:Susan.ebrahimi55@gmail.com?subject=" +
                encodeURIComponent(subject) +
                "&body=" +
                encodeURIComponent(body);
            var status = document.getElementById("formStatus");
            if (status) {
                status.textContent =
                    "Your email app should open with the message ready to send. If it doesn't, email Susan.ebrahimi55@gmail.com directly.";
            }
        });
    }
})();
