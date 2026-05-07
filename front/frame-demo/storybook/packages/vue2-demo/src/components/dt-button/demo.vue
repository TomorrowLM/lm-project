<style lang="scss" scoped>
  .dt-button-demo-box{
    padding: 20px 5px;
  }
</style>

<template>
  <div class="dt-button-demo-box">
    <dtButton type="primary" size="mini">mini</dtButton>
    <dtButton type="primary" size="mini" loading>mini</dtButton>
    <dtButton type="danger" size="mini">mini</dtButton>
    <dtButton type="warning" size="mini">mini</dtButton>
    <dtButton type="hollow" size="mini">mini</dtButton>

    <div style="height: .5rem;"></div>

    <dtButton type="primary">primary</dtButton>
    <dtButton type="primary" loading>loading</dtButton>
    <dtButton type="danger">danger</dtButton>
    <dtButton type="warning">warning</dtButton>
    <dtButton type="hollow">hollow</dtButton>

    <dtButton size="large" type="primary">primary</dtButton>
    <dtButton size="large" type="primary" loading loading-txt="缓慢提交中...">loading</dtButton>
    <dtButton size="large" type="danger">danger</dtButton>
    <dtButton size="large" type="warning">warning</dtButton>
    <dtButton size="large" type="disabled" disabled>disabled</dtButton>
    <dtButton size="large" type="hollow">hollow</dtButton>

    <dtButton size="large" type="primary" shape="circle">shape="circle"</dtButton>
    <dtButton size="large" type="primary" shape="angle">shape="angle"</dtButton>
    <dtButton size="large" type="hollow" shape="circle">shape="circle"</dtButton>
    <dtButton size="large" type="hollow" shape="angle">shape="angle"</dtButton>
  </div>
</template>

<script>
import dtButton from './button'

export default {
  data () {
    return {

    }
  },
  components: {
    dtButton
  }
}
</script>