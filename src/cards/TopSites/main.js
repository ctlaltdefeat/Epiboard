import * as VList from 'vuetify/es5/components/VList';

// @vue/component
export default {
  name: 'TopSites',
  components: {
    ...VList,
  },
  props: {
    settings: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      topSites: [],
    };
  },
  created() {
    Promise.all([this.getTopSites()])
      .then(() => this.$emit('init'))
      .catch(err => this.$emit('init', err));
  },
  methods: {
    getTopSites() {
      return browser.topSites.get().then((topSites) => {
        this.topSites = topSites.slice(0, this.settings.maxSites)
          .map(f => ({ ...f, ...{ icon: this.$utils.getFavicon(f.url) } }));
      });
    },
  },
};
