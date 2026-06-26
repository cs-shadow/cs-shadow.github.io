#!/usr/bin/env ruby
# frozen_string_literal: true

site_dir = ARGV[0] || "_site"
index_path = File.join(site_dir, "index.html")
html = File.read(index_path)

unless html.include?('<meta name="robots" content="noindex, nofollow">')
  warn "Preview build is missing noindex robots meta tag in #{index_path}."
  exit 1
end

puts "Preview noindex meta tag is present."
