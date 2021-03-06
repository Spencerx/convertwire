(function (module) {

  'use strict';

  var _ = require('lodash');
  var buildFlags = require('./converters-build-flags.js');
  var listElements = ['UL', 'OL', 'LI'];
  var _options = {};

  var getListDepth = function (node, level, increment) {
    var isListElement, isListItemElement;

    isListElement = _.contains(listElements, node.nodeName);
    isListItemElement = node.nodeName === 'LI';

    if (isListElement) {
      level += increment;

      if (isListItemElement) {
        level = getListDepth(node.parentNode, level, 1);
      }
      else {
        level = getListDepth(node.parentNode, level, 0);
      }
    }

    return level;
  };

  var getListLevel = function (node, level) {
    var increment;

    if (!level) {
      level = 0;
    }

    increment = level;

    level = getListDepth(node, level, increment);

    return level;
  };

  var getElementInfo = function (content, node) {
    var info = {};
    info.isOrderedListItem = /ol/i.test(node.parentNode.nodeName);
    info.delimiter = /ol/i.test(node.parentNode.nodeName)? '.' : '*';
    info.listLevel = getListLevel(node);
    info.hasBuildFlags = buildFlags.hasDocXBuildFlags(node);
    info.orderedItemNumber = Array.prototype.indexOf.call(node.parentNode.children, node) + 1;
    info.isNestedListItemContainer = _.startsWith(content, '\n*') || _.startsWith(content, '\n.'); ///li|ol/i.test(node.parentNode.parentNode.nodeName);
    return info;
  };

  var headers = {
    filter: function (node) {
      var match, tags;

      tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      match = false;

      if (tags.indexOf(node.nodeName.toLowerCase()) > -1) {
        if (node.className !== 'ig-document-title') {
          match = true;
        }
      }

      return match;
    },
    replacement: function (content, node) {
      var hLevel, hPrefix, value = '', anchorMatches, anchor = '', headerText = '', id;

      hLevel = parseInt(node.nodeName.charAt(1));
      hPrefix = '';

      if(!_options.allowH1Headers) {
        if(hLevel === 1){
          hLevel = 2;
        }
      }

      id = node.getAttribute('id');
      
      if(hLevel >= 6){
          hLevel = 6;
      }
      
      hPrefix = Array(hLevel + 1).join('=');
      
      if(!_.contains(content, '<<')){
        content = content.replace(/<[^>]*>/gi, '');  
      }
      
      if(_.endsWith(content, '\n')){
        content = _.trimRight(content, '\n');
      }
      
      anchorMatches = content.match(/(\[\[.+\]\])/g);
      
      headerText = content;
      
      if(anchorMatches){
        anchorMatches.forEach((match) => {
          headerText = headerText.replace(match, '');
        });
      } else {
        anchorMatches = [];
      }
      
      headerText = headerText.replace(/\n/g, '').trim();
      
      if(content && headerText.length > 0){
        value = '\n' + hPrefix + ' ' + headerText;  
      }

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }

      if(id) {
        id = `[[${id}]]`;
      } else {
        id = '';
      }
      
      value = '\n\n' + id + anchorMatches.join('\n') + value + '\n\n';

      return value;
    }
  };
  
  var spanTemporary = {
    filter: function(node){
      var match = false;
      match = (node.nodeName === 'SPAN' && 
               node.className === 'temporary');
      return match;
    },
    replacement: function(content, node){
      return '';
    }
  };

  var hr = {
    filter: 'hr',
    replacement: function () {
      return "\n\n'''\n\n";
    }
  };

  var bold = {
    filter: ['strong', 'b'],
    replacement: function (content, node) {
      var value;

      value = content;

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }
      return '*' + value.trim() + '*';
    }
  };
  
  var italic = {
    filter: ['em', 'i'],
    replacement: function (content, node) {
      var value = ' ';
      
      if(content !== ' ') {
        value = content;

        if (buildFlags.hasDocXBuildFlags(node)) {
            value = buildFlags.wrapWithBuildFlags(value, node);
        }
        
        value = ' _' + value.trim() + '_ ';
      }
      
      return value;

    }
  };
  
  var paragraph = {
    filter: 'p',
    replacement: function (content, node) {
      var value;

      value = content;

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }
      return '\n\n' + value.trim(); + '\n\n';
    }
  };

  var anchorWithoutHref = {
    filter: function (node) {
      return node.nodeName === 'A' && 
            (node.getAttribute('href') === null) &&
            (node.getAttribute('id') === null);
    },
    replacement: function (content, node) {
      return '';
    }
  };
  
  var anchorWithIdAsAnchor = {
    filter: (node) => {
      var match = false, id, name;
      
      id = node.getAttribute('id');
      name = node.getAttribute('name');
      
      match = (node.nodeName === 'A' && id !== null) ||
              (node.nodeName === 'A' && name !== null);
      
      return match;
    },
    replacement: (content, node) => {
      var value = '', id, name, identifier;
      
      id = node.getAttribute('id');
      name = node.getAttribute('name');
      
      if(!_.startsWith(id, 'OLE')){
        identifier = id ? id : name;
        
        value = `\n\n[[${identifier.replace(/ /g, '-')}]]\n${content}`;
      }
      
      return value;
    }
  };
  
  var anchorInDocumentHref = {
    filter: (node) => {
      var match = false, href;
      
      href = node.getAttribute('href');
      if(node.nodeName === 'A' && href !== null){
        match = (href[0] === '#');
      } 
      
      return match;
    },
    replacement: (content, node) => {
      var value, href;
      
      href = node.getAttribute('href').replace('#', '');
      
      value = `<<${href},${content}>>`;
      
      return value; 
    }
  };

  var anchorWithHref = {
    filter: function (node) {
      return node.nodeName === 'A' && node.getAttribute('href');
    },
    replacement: function (content, node) {
      var value;

      value = 'link:' + node.getAttribute('href') + '[' + content + ']';

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }

      return value;
    }
  };

	var buildFlagImages = {
		filter: (node) => {
			var match = false;

			match = (/img/i.test(node.nodeName) && 
					 /tripwire-build-flag-begin|end\.png/i.test(node.getAttribute("src")));

			return match;
		},
		replacement: (content, node) => {
			var flags = node.getAttribute('alt');
			var isBeginFlag = /tripwire-build-flag-begin\.png/i.test(node.getAttribute('src'));
			var value = '';

			if(isBeginFlag) {
				value = `ifdef::${flags}[]`;
			} else {
				value = `endif::${flags}[]`;
			}

			return value;
		}
	};

  var img = {
    filter: 'img',
    replacement: function (content, node) {
      var alt, src, title, titlePart, value, colon = '::', width, height;

      alt = node.alt || '';
      src = node.getAttribute('src') || '';
      title = node.title || '';
      titlePart = title ? ' "' + title + '"' : '';

      width = node.getAttribute('width');
      height = node.getAttribute('height');

      if(width) {
        width = ',width="' + width + '"';
      } else {
        width = '';
      }

      if(height) {
        height = ',height="' + height + '"';
      } else {
        height = '';
      }

      var isInlineImage = /image/i.test(node.parentNode.className);

      colon = isInlineImage ? ':' : '::';

      value = 'image' + colon + src + titlePart + '[' + alt + width + height + ']';

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }

      if(!isInlineImage) {
        value = '\n\n' + value + '\n\n';
      }

      return value;
    }
  };

  var ul = {
    filter: ['ul', 'ol'],
    replacement: function (content, node) {
      var element;

      element = getElementInfo(content, node);

      if (element.hasBuildFlags) {
        content = buildFlags.wrapWithBuildFlags(content, node);
      }

      return '\n\n\<temp-token role="list:start">' + content + '\n\n';
    }
  };

  var li = {
    filter: 'li',
    replacement: function (content, node) {
      var
        prefix = '',
        parent = node.parentNode,
        startValue,
        element;

      element = getElementInfo(content, node);
      
      if(element.listLevel > 0){
        prefix = Array(element.listLevel + 1).join(element.delimiter) + ' ';
      } else {
        prefix = element.delimiter + ' ';
      }

      if (element.isOrderedListItem) {
        if (element.orderedItemNumber === 1) {
          startValue = parent.getAttribute('start');
          startValue = (startValue === null) ? element.orderedItemNumber : startValue;
        } else {
          startValue = element.orderedItemNumber;
        }
        prefix = '[start=' + startValue + ']\n' + prefix;
      }

      content = prefix + content.trim() + '\n';

      if (element.hasBuildFlags) {
        content = buildFlags.wrapWithBuildFlags(content, node);
      }

    /*
		 * removing for now per conversation with Liz. Using line
		 * continuation characters will end up breaking notes, code 
		 * listings and other nested elements, so its worth 
		 * not having all lines indented in favor of working content

      // strip extra line breaks for line continuation
      content = content.replace(/\n{1,}\+\n{1,}/gi, '\n+\n');

      // remove extra characters/line break for first list item
      /*
       * changes this:

[start=1]
. 
+
*Set up a project with an UltraCalcManager and a DataGridView.*

        to this:

[start=1]
. *Set up a project with an UltraCalcManager and a DataGridView.*
      */
      //content = content.replace(/]\n\. \n\+\n/, ']\n\. ');

      return content;
    }
  };

  var blockquote = {
    filter: 'blockquote',
    replacement: function (content, node) {
      var value;

      content = this.trim(content);
      content = content.replace(/\n{3,}/g, '\n\n');
      content = content.replace(/^/gm, '');
      value = '\n\n____\n' + content + '\n____\n\n';

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }

      return value;
    }
  };

  var center = {
    filter: 'center',
    replacement: function (content) {
      return content;
    }
  }

  var br = {
    filter: 'br',
    replacement: function () {
      return '\n\n';
    }
  };

  var del = {
    filter: ['del', 's', 'strike'],
    replacement: function (content, node) {
      var value;

      value = '[line-through]*' + content + '*';

      if (buildFlags.hasDocXBuildFlags(node)) {
        value = buildFlags.wrapWithBuildFlags(value, node);
      }

      return value;
    }
  };

  var checkboxListItem = {
    filter: function (node) {
      return node.type === 'checkbox' && node.parentNode.nodeName === 'LI';
    },
    replacement: function (content, node) {
      return (node.checked ? '[x]' : '[ ]') + ' ';
    }
  };

  var converters = [];

  converters.push(italic);
  converters.push(anchorWithIdAsAnchor);
  converters.push(headers);
  converters.push(hr);
  converters.push(spanTemporary);
  converters.push(bold);
  converters.push(paragraph);
  converters.push(anchorWithoutHref);
  converters.push(anchorInDocumentHref);
  converters.push(anchorWithHref);
  converters.push(buildFlagImages);
  converters.push(img);
  converters.push(ul);
  converters.push(li);
  converters.push(blockquote);
  converters.push(center);
  converters.push(br);
  converters.push(del);
  converters.push(checkboxListItem);

  module.get = function (options) {
    _options = options;
    return converters;
  };

} (module.exports));