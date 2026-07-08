# Reading data

The homepage reading section uses `site/_data/goodreads_books.yml`. This file
is generated; do not edit it by hand.

Set the repository Actions variable `GOODREADS_USER_ID` to the numeric ID from
the public Goodreads profile URL. The daily workflow reads the public
`currently-reading` and `read` RSS feeds. It also supports manual dispatch.
The workflow fails without replacing the last successful data when Goodreads
is unavailable or its response contains no usable books. Both shelves are
fetched and parsed in full, then the generated file retains the 12 books with
the most recent activity dates for the homepage.

## Reviews

To associate a full review, publish an ordinary post with the same string ID:

```yaml
---
title: My review
goodreads_id: "123456"
---
```

## CSV fallback

Goodreads has deprecated its public API, and its RSS format may change. As a
manual fallback, export the library CSV from Goodreads, then run:

```shell
ruby script/sync_goodreads.rb --csv goodreads_library_export.csv
```

The import uses the `currently-reading` and `read` exclusive shelves. A CSV
does not contain cover URLs, so imported records use the site's neutral cover
placeholder. Review the generated diff and commit only
`site/_data/goodreads_books.yml`.
