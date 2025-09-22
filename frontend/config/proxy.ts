/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */

const API_URL = process.env.APP_API_URL || 'http://localhost:3003';

export default {
  // 本地开发环境代理配置
  dev: {
    // localhost:8000/api/** -> http://localhost:3003/api/**
    '/api/': {
      // 要代理的后端地址
      target: API_URL,
      // 配置了这个可以从 http 代理到 https
      // 依赖 origin 的功能可能需要这个，比如 cookie
      changeOrigin: true,
    },
    // localhost:8000/images/** -> http://localhost:3003/images/**
    '/images/': {
      target: API_URL,
      changeOrigin: true,
    },
  },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    // localhost:8000/api/** -> http://localhost:3003/api/**
    '/api/': {
      target: API_URL,
      changeOrigin: true,
    },
    '/images/': {
      target: API_URL,
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: API_URL,
      changeOrigin: true,
    },
    '/images/': {
      target: API_URL,
      changeOrigin: true,
    },
  },
};
