/**
 * 逐段加载（progressive reveal）
 *
 * 页面各区块带有 data-reveal="<序号>"，按序号从小到大依次淡入上浮：
 * 首页顺序为 头像卡片 → 文章卡片 → 归档卡片 → 标签卡片 → 页脚；
 * 列表页 / 文章页顺序为 主体内容 → 页脚。
 *
 * 设计要点：
 * - 已按序号排序，保证「文章卡片优先」不依赖 DOM 顺序；
 * - 页脚排到最后（序号 20），列表页主体也排在其前面；
 * - 使用 requestAnimationFrame + transition，无需额外依赖；
 * - 元素若在视口下方，先保持隐藏由 IntersectionObserver 在其进入视口时补播；
 * - 样式 / JS 未生效时元素默认可见，不会白屏。
 */
(function () {
    "use strict";

    var STEP_MS = 60; // 相邻区块的出现间隔
    var DURATION_MS = 450; // 单块动画时长
    var FOOTER_ORDER = 20; // 页脚固定最后出现

    var prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function collect() {
        var nodes = Array.prototype.slice.call(
            document.querySelectorAll("[data-reveal]")
        );
        nodes.forEach(function (el) {
            el.classList.add("progressive-item");
        });
        // 逐个排序，排序键：data-reveal 数值 + 文档出现顺序
        nodes.sort(function (a, b) {
            var ra = parseFloat(a.getAttribute("data-reveal")),
                rb = parseFloat(b.getAttribute("data-reveal"));
            if (isNaN(ra)) ra = FOOTER_ORDER;
            if (isNaN(rb)) rb = FOOTER_ORDER;
            if (ra !== rb) return ra - rb;
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
                ? -1
                : 1;
        });
        return nodes;
    }

    function reveal(el) {
        if (el.classList.contains("progressive-visible")) return;
        el.classList.add("progressive-visible");
    }

    function revealAll(nodes) {
        nodes.forEach(reveal);
    }

    function start() {
        var nodes = collect();
        if (!nodes.length) return;

        if (prefersReducedMotion || !("IntersectionObserver" in window)) {
            revealAll(nodes);
            return;
        }

        var viewport = window.innerHeight || document.documentElement.clientHeight;
        var pending = [];
        var index = 0;

        // 视口下方的区块先不参与首屏序列，等滚动到位再补播
        nodes.forEach(function (el) {
            if (el.getBoundingClientRect().top > viewport * 0.9) pending.push(el);
        });
        nodes = nodes.filter(function (el) {
            return pending.indexOf(el) === -1;
        });

        function playNext() {
            if (index >= nodes.length) return;
            var el = nodes[index++];
            reveal(el);
            window.setTimeout(playNext, STEP_MS);
        }

        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(playNext);
        });

        if (pending.length) {
            var observer = new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        if (!entry.isIntersecting) return;
                        observer.unobserve(entry.target);
                        reveal(entry.target);
                    });
                },
                { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
            );
            pending.forEach(function (el) {
                observer.observe(el);
            });
        }

        // 兜底：即使动画链路异常，也在序列结束后确保全部可见
        window.setTimeout(
            function () {
                revealAll(nodes.concat(pending));
            },
            STEP_MS * nodes.length + DURATION_MS + 600
        );

        window.__PROGRESSIVE_LOADING_MS__ = STEP_MS * nodes.length + DURATION_MS;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
