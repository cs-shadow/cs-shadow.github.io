---
layout: post
title: 'Entity Embed: A module to allow any entity to be embedded.'
redirect_from:
  - blog/entity-embed-module-allow-any-entity-be-embedded/
---
Hello Drupal!

This is my first blog post after [my proposal](http://web.iiit.ac.in/~chandan.singh/GSoC14-DrupalProposal-WYSIWYG_Inline_entity.pdf) got accepted into Google Summer of Code 2014. I'll briefly explain the idea here, and in following posts I'll provide further details.

The idea is to develop a module called [Entity Embed](https://drupal.org/project/entity_embed) for Drupal 8. This module will allow any entity to be embedded using a WYSIWYG and text format. This module eliminate the need to have separate modules to handle nodes, images etc. This single module will be able to handle all different **entities** present in the Drupal site. The interface to embed any entity will be integrated with CKEditor. Though embedding through UI will be the standard workflow for most users, entities can also be embedded through special text formats. For instance a node object can be embedded in following manner:

```html
<div data-entity-type="node" data-entity-uuid="07bf3a2e-1941-4a44-9b02-2d1d7a41ec0e" data-view-mode="teaser" />
```

All the data attributes are not yet finalized but this will be the low-level structure of the embeds. We've not using any custom format (or JSON format) because using HTML syntax with specified data attributes is the standard way these days.

We're planning to keep the UI for this module very simple and the main focus will be to provide a robust set of APIs to support embeds.

This is the github repo of the project: <https://github.com/drupal-media/entity_embed>, which will be used for all the development during the course of this project.

I'm working on this project alongwith my mentors: Dave Reid([davereid](https://drupal.org/user/53892)), Janez Urvec([slashrsm](https://drupal.org/user/744628)) and Shashwat Srivastava([darklrd](https://drupal.org/user/435209))

Feel free to conatct me. You can find me on IRC as 'cs_shadow'. I'm usually lurking around on #drupal, #drupal-contribute, #drupal-media channels.
