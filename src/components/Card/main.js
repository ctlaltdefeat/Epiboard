import * as VList from 'vuetify/es5/components/VList';
import * as VToolbar from 'vuetify/es5/components/VToolbar';
import { VMenu, VDivider } from 'vuetify';
import Toast from '@/components/Toast';

// @vue/component
export default {
  name: 'Card',
  components: {
    ...VList,
    ...VToolbar,
    VDivider,
    VMenu,
  },
  directives: {
    initSettings: {
      isLiteral: true,
      bind: (el, { value }, { componentInstance }) => {
        componentInstance.$data.settings = { ...value }; // eslint-disable-line no-param-reassign
      },
      unbind: (el, binding, { context, componentInstance }) => {
        if (context.$data.pendingSave && componentInstance.$data.settings) {
          context.saveSettings(componentInstance.$data.settings);
        }
      },
    },
    init: {
      isLiteral: true,
      bind: (el, { value }, { context, componentInstance }) => {
        /* eslint-disable no-param-reassign */
        const data = context.$store.state.cache.cards[value];
        if (!data) return;
        const keys = Object.keys(data);
        const { CACHE_DT } = data;
        if (CACHE_DT && context.$store.state.cache.validCards.indexOf(value) > -1) {
          // Default cache timeout is 60s
          const cacheValidity = ((Cards[value].manifest || {}).cacheValidity || 60) * 1000;
          componentInstance.VALID_CACHE = Date.now() < CACHE_DT + cacheValidity;
        }
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (componentInstance.$data[key] !== undefined) {
            componentInstance.$data[key] = data[key];
          }
        }
        /* eslint-enable no-param-reassign */
      },
    },
  },
  props: {
    id: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      title: null,
      subTitle: null,
      cmp: {
        card: null,
        settings: null,
      },
      showSettings: false,
      pendingSave: false,
      loaded: 0,
      hash: '',
      actions: [],
    };
  },
  computed: {
    defaultTitle() {
      const translation = this.$t(`${this.id}.title`);
      if (translation === `${this.id}.title`) return this.id;
      return translation;
    },
    theme() {
      if (this.options.theme && !this.showSettings) {
        return this.options.theme;
      }
      return null;
    },
    options() {
      return Cards[this.id].manifest || {};
    },
    debug() {
      return this.$store.state.settings.debug;
    },
    titleColor() {
      if (this.theme && this.theme.title) {
        if (this.theme.title === 'auto') return undefined;
        return this.theme.title;
      }
      return this.$vuetify.theme.foreground;
    },
    actionsColor() {
      if (this.theme && this.theme.actions) {
        if (this.theme.actions === 'auto') return undefined;
        return this.theme.actions;
      }
      return this.$vuetify.theme.foreground;
    },
    settings() {
      const data = Cards[this.id].settings;
      if (!data || this.hash == null) return {};
      const tmp = this.$store.state.cardsSettings.cards[this.id];
      if (!tmp) return data;
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length; i += 1) {
        if (typeof data[keys[i]] === typeof tmp[keys[i]]) {
          data[keys[i]] = tmp[keys[i]];
        }
      }
      return data;
    },
  },
  created() {
    const { id } = this;
    this.cmp.card = () => this.checkPermissions()
      .then(() => import(/* webpackInclude: /index\.vue$/, webpackMode: "eager" */`@/cards/${id}/index.vue`))
      .then(tmp => tmp.default)
      .catch((err) => {
        Toast.show({
          title: this.$t('card.permissions_failed', { id }),
          color: 'error',
          timeout: 10000,
          dismissible: false,
        });
        this.remove();
        throw err;
      });
    if (Cards[id].settings && Cards[id].settingsCmp) {
      this.cmp.settings = () => import(/* webpackInclude: /settings\.vue$/, webpackChunkName: "cards-settings", webpackMode: "lazy-once" */`@/cards/${id}/settings.vue`)
        .then(tmp => tmp.default);
    }
  },
  methods: {
    checkPermissions() {
      const { permissions, origins } = this.options;
      // Speed up first frame rendering
      if ((!permissions && !origins) || this.$store.state.cache.validCards.indexOf(this.id) > -1) {
        return Promise.resolve();
      }
      const payload = { permissions: permissions || [], origins: origins || [] };
      return this.$utils.checkPermissions(payload, this.defaultTitle);
    },
    remove() {
      if (this.options.permissions || this.options.origins) {
        browser.permissions.remove({
          permissions: this.options.permissions || [],
          origins: this.options.origins || [],
        });
      }
      this.$emit('deleted');
    },
    init(res) {
      this.loaded = 1;
      if (res === undefined) {
        if (this.$store.state.cache.cards[this.id] !== undefined) {
          this.$store.commit('DEL_CARD_CACHE', this.id);
        }
        this.$store.commit('ADD_VALID_CARD', this.id);
      } else if (res instanceof Error) {
        this.$store.commit('DEL_VALID_CARD', this.id);
        this.loaded = 2;
        Toast.show({
          title: this.$t('card.error', { id: this.id }),
          desc: this.$store.state.settings.debug ? res.message : null,
          color: 'error',
          timeout: 10000,
          dismissible: false,
        });
        if (this.$store.state.settings.debug) throw res;
      } else if (res === true || res === false || Array.isArray(res)) {
        this.$store.commit('ADD_VALID_CARD', this.id);
        const toWatch = Array.isArray(res) ? vm => res.map(f => vm[f]) : '$data';
        this.$refs.card.$watch(toWatch, () => {
          const o = this.$refs.card.$data;
          const data = Array.isArray(res)
            ? res.reduce((r, p) => (p in o ? { ...r, [p]: o[p] } : r), {}) : o;
          this.$store.commit('SET_CARD_CACHE', { key: this.id, data });
        }, { immediate: !!res, deep: true });
      }
    },
    reload(delCache = true) {
      this.loaded = 0;
      this.subTitle = null;
      this.$store.commit('DEL_VALID_CARD', this.id);
      if (delCache) this.$store.commit('DEL_CARD_CACHE', this.id);
      this.hash = Date.now().toString();
    },
    resetSettings() {
      this.$store.commit('DEL_CARD_SETTINGS', this.id);
      this.hash = Date.now().toString();
    },
    closeSettings(willSave) {
      this.pendingSave = willSave;
      this.showSettings = false;
    },
    saveSettings(data) {
      this.$store.commit('SET_CARD_SETTINGS', { key: this.id, data });
      this.reload(false);
      this.pendingSave = false;
    },
  },
};
