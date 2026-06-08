const Image = require("@11ty/eleventy-img");
const path = require("path");
const CleanCSS = require("clean-css");
const { minify } = require("terser");

module.exports = function(eleventyConfig) {
  // CSS Minifier
  eleventyConfig.addFilter("cssmin", function(code) {
      return new CleanCSS({}).minify(code).styles;
  });

  // JS Minifier
  eleventyConfig.addNunjucksAsyncFilter("jsmin", async function(code, callback) {
      try {
          const minified = await minify(code);
          callback(null, minified.code);
      } catch(err) {
          console.error("Terser error: ", err);
          callback(null, code);
      }
  });

  // Passthrough copy for assets and css
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/assets");

  // Image shortcode
  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, sizes, className = "", loading = "lazy") {
    // If it's a relative path starting with /, prepend ./src
    let fullSrc = src;
    if (src.startsWith("/")) {
      fullSrc = `./src${src}`;
    }

    let metadata = await Image(fullSrc, {
      widths: [400, 800, 1200, 2000],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
      sharpAvifOptions: { quality: 50 },
      sharpWebpOptions: { quality: 60 },
      sharpJpegOptions: { quality: 60 }
    });

    let imageAttributes = {
      alt,
      sizes,
      loading,
      decoding: "async",
      class: className
    };
    if (loading === "eager") {
        imageAttributes.fetchpriority = "high";
    }

    return Image.generateHTML(metadata, imageAttributes);
  });

  // Shortcode to preload the hero image in <head>
  eleventyConfig.addNunjucksAsyncShortcode("hero_preload", async function(src) {
    let fullSrc = src.startsWith("/") ? `./src${src}` : src;
    let metadata = await Image(fullSrc, {
      widths: [400], // Preload exact mobile size for Lighthouse
      formats: ["avif"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
      sharpAvifOptions: { quality: 50 }
    });
    let url = metadata.avif[0].url;
    return `<link rel="preload" href="${url}" as="image" type="image/avif" fetchpriority="high">`;
  });




  
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};

