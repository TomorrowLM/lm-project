<template>
    <image :src="imageSrc" :mode="mode" @error="error" @load="load"></image>
</template>

<script>
    export default {
        name: 'dhImage',
        props: {
            src: {
                type: String,
                default: ''
            },
            errorSrc: {
                type: String,
                default: '/static/images/share_default.png'
            },
            mode: {
                type: String,
                default: 'aspectFill'
            }
        },
        data() {
            return {
                imageSrc: ''
            };
        },
        methods: {
            error(e) {
                this.imageSrc = this.errorSrc;
                this.$emit("error", e);
            },
            load(e) {
                this.$emit("load", e);
            }
        },
        created() {
            this.imageSrc = this.src;
        }
    }
</script>

<style>

</style>
