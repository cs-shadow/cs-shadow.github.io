---
layout: post
title: 'Entity Embed: A module to allow any entity to be embedded.'
created: 1400594799
---
<p>Hello Drupal!</p>

<p>This is my first blog post after <a href="web.iiit.ac.in/~chandan.singh/GSoC14-DrupalProposal-WYSIWYG_Inline_entity.pdf" target="_blank">my proposal</a> got accepted into Google Summer of Code 2014. I&#39;ll briefly explain the idea here, and in following posts I'll provide further details.</p>

<p>The idea is to develop a module called &#39;Entity Embed&#39; (https://drupal.org/project/entity_embed) for Drupal 8. This module will allow&nbsp;any entity to be embedded using a WYSIWYG and text format. This module eliminate the need to have separate modules to handle nodes, images etc. This single module will be able to handle all different <strong>entities</strong>&nbsp;present in the Drupal site. The interface to embed any entity will be integrated with CKEditor. Though embedding through UI will be the standard workflow for most users, entities can also be embedded through special text formats. For instance a node object can be embedded in following manner:</p>

<pre>
&lt;div data-entity-type=&quot;node&quot; data-entity-uuid=&quot;07bf3a2e-1941-4a44-9b02-2d1d7a41ec0e&quot; data-view-mode=&quot;teaser&quot; /&gt;</pre>

<p>All the data attributes are not yet finalized but this will be the low-level structure of the embeds. We&#39;ve not using any custom format (or JSON format) because using HTML syntax with specified data attributes is the standard way these days.</p>

<p>We&#39;re planning to keep the UI for this module very simple and the main focus will be to provide a robust set of APIs to support embeds.</p>

<p>This is the github repo of the project:&nbsp;https://github.com/drupal-media/entity_embed, which will be used for all the development during the course of this project.</p>

<p>I&#39;m working on this project alongwith my mentors: Dave Reid(<a href="https://drupal.org/user/53892" target="_blank">davereid</a>), Janez Urvec(<a href="https://drupal.org/user/744628" target="_blank">slashrsm</a>) and&nbsp;Shashwat Srivastava(<a href="https://drupal.org/user/435209" target="_blank">darklrd</a>)</p>

<p>Feel free to conatct me. You can find me on IRC as 'cs_shadow'. I'm usually lurking around on #drupal, #drupal-contribute, #drupal-media channels. </p>
