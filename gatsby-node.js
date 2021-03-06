const webpack = require("webpack");
//const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const _ = require("lodash");
const Promise = require("bluebird");
const path = require("path");
const { createFilePath } = require(`gatsby-source-filesystem`);
const { store } = require(`./node_modules/gatsby/dist/redux`);
var request = require('request')
require("dotenv").config()

//today's date

let today

const getDate = () => {
  today = new Date
  let dd = today.getDate()
  let mm = today.getMonth() + 1
  const yyyy = today.getFullYear()
  if (dd < 10) {
    dd = '0' + dd
  }
  if (mm < 10) {
    mm = '0' + mm
  }
  today = yyyy + '-' + mm + '-' + dd
}

exports.onCreateNode = ({ node, getNode, boundActionCreators }) => {
  const { createNodeField } = boundActionCreators;
  if (node.internal.type === `MarkdownRemark`) {
    const slug = createFilePath({ node, getNode, basePath: `pages` });
    const separtorIndex = ~slug.indexOf("--") ? slug.indexOf("--") : 0;
    const shortSlugStart = separtorIndex ? separtorIndex + 2 : 0;
    createNodeField({
      node,
      name: `slug`,
      value: `${separtorIndex ? "/" : ""}${slug.substring(shortSlugStart)}`
    });
    createNodeField({
      node,
      name: `prefix`,
      value: separtorIndex ? slug.substring(1, separtorIndex) : ""
    });
  }
};

exports.createPages = ({ graphql, boundActionCreators }) => {
  const { createPage } = boundActionCreators;


  return new Promise((resolve, reject) => {
    const postTemplate = path.resolve("./src/templates/PostTemplate.js");
    const pageTemplate = path.resolve("./src/templates/PageTemplate.js");
    resolve(
      graphql(
        `
          {
            allMarkdownRemark(
              filter: { id: { regex: "//posts|pages//" } }, 
              limit: 1000,
              sort: {fields: [fileAbsolutePath], order: ASC}) {
              edges {
                node {
                  html
                  id
                  fields {
                    slug
                    prefix
                  }
                  frontmatter {
                    title
                    subTitle
                    category
                  }
                }
              }
            }
          }
        `
      ).then(result => {
        if (result.errors) {
          console.log(result.errors);
          reject(result.errors);
        }
        // Create posts and pages.
        const edges = result.data.allMarkdownRemark.edges
        const titles = []
        const ghtml = {}
        const gslugs = []
        const dates = []
        const gids = []
        getDate()
        console.log('today: ', today)
        const npost = {}
        edges.map((edge, i) => {
          const title = edge.node.frontmatter.title
          const subTitle = edge.node.frontmatter.subTitle
          const category = edge.node.frontmatter.category
          const html = edge.node.html
          const slug = edge.node.fields.slug
          const date = edge.node.fields.prefix
          const id = edge.node.id
          if (!titles.includes(title)) {
            titles.push(title)
            if (date === today) {
              npost["Title"] = title
              npost["Subtitle"] = subTitle
              npost["Category"] = category
              npost["Slug"] = slug
              npost["PDate"] = date
              console.log('npost', npost)
              let jshaun = JSON.stringify(npost)
              request({
                method: 'POST',
                uri: `http://localhost:4000/${process.env.ADDPOST}`,
                headers: {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(jshaun)
                },
                body: jshaun
              }, function (err, res, body) {
                if (err) {
                  console.log('error', err)
                } else {
                  console.log('success', res.body)
                }
              })
            }
          }
          if (ghtml[title]) {
            ghtml[title] += html
          } else {
            ghtml[title] = html
            gslugs.push(slug)
            gids.push(id)
            dates.push(date)
            console.log("date", date)
          }
        })
        for (var i in titles) {
          console.log(titles[i])
          const isPost = /posts/.test(gids[i])
          createPage({
            path: gslugs[i],
            component: isPost ? postTemplate : pageTemplate,
            context: {
              slug: gslugs[i],
              html: ghtml[titles[i]],
              date: dates[i]
            }
          })
        }
      })
    )
  });
};


exports.modifyWebpackConfig = ({ config, stage }) => {
  switch (stage) {
    case "build-javascript":
      {
        let components = store.getState().pages.map(page => page.componentChunkName);
        components = _.uniq(components);
        config.plugin("CommonsChunkPlugin", webpack.optimize.CommonsChunkPlugin, [
          {
            name: `commons`,
            chunks: [`app`, ...components],
            minChunks: (module, count) => {
              const vendorModuleList = []; // [`material-ui`, `lodash`];
              const isFramework = _.some(
                vendorModuleList.map(vendor => {
                  const regex = new RegExp(`[\\\\/]node_modules[\\\\/]${vendor}[\\\\/].*`, `i`);
                  return regex.test(module.resource);
                })
              );
              return isFramework || count > 1;
            }
          }
        ]);
        // config.plugin("BundleAnalyzerPlugin", BundleAnalyzerPlugin, [
        //   {
        //     analyzerMode: "static",
        //     reportFilename: "./report/treemap.html",
        //     openAnalyzer: true,
        //     logLevel: "error",
        //     defaultSizes: "gzip"
        //   }
        // ]);
      }
      break;
  }
  return config;
};

exports.modifyBabelrc = ({ babelrc }) => {
  return {
    ...babelrc,
    plugins: babelrc.plugins.concat([`syntax-dynamic-import`, `dynamic-import-webpack`])
  };
};
