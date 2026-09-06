<template>
    <InsBimViewer
        :tileset-urls="tilesetUrls"
        :gltf-urls="gltfUrls"
    />
</template>

<script>
export default {
    data() {
        return {
            tilesetUrls: ['./data/3dtiles/tileset.json'],
            gltfUrls: ['./data/gltf/jfs-bim.glb'],
        }
    },
}
</script>

<style>

</style>