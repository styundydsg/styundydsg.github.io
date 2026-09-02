mixins.preview = {
    data() {
        return { previewShow: false };
    },
    created() {
        this.renderers.push(this.preview);
    },
    methods: {
        preview() {
            let preview = this.$refs.preview,
                content = this.$refs.previewContent;
            let images = document.querySelectorAll("img");
            for (let i of images) {
                // 跳过导航/图标类图片（如图标链接里的 gitcode、文章里带链接的图），
                // 避免点击它们时先弹出全屏预览、随浏览器前进/后退缓存残留。
                if (i.closest("a")) continue;
                i.addEventListener("click", () => {
                    content.alt = i.alt;
                    content.src = i.src;
                    this.previewShow = true;
                });
            }
            preview.addEventListener("click", () => {
                this.previewShow = false;
            });
            window.addEventListener("resize", () => {
                this.previewShow = false;
            });
        },
    },
};
