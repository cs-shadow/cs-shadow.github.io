#!/usr/bin/env ruby
# frozen_string_literal: true

site_dir = ARGV[0] || "_site"
list_path = ARGV[1] || "ci/preserved_urls.txt"

missing = File.readlines(list_path).filter_map do |line|
  url = line.sub(/#.*/, "").strip
  next if url.empty?

  relative = url.sub(%r{\A/}, "")
  candidates =
    if url.end_with?("/")
      [File.join(site_dir, relative, "index.html")]
    else
      [File.join(site_dir, relative), File.join(site_dir, relative, "index.html")]
    end

  url unless candidates.any? { |path| File.file?(path) }
end

if missing.any?
  warn "Missing preserved URLs:"
  missing.each { |url| warn "  #{url}" }
  exit 1
end

puts "Verified #{File.readlines(list_path).grep_v(/\A\s*(#|\z)/).count} preserved URLs."
