#!/usr/bin/env ruby
# frozen_string_literal: true

require "pathname"
require "uri"

site_dir = Pathname.new(ARGV[0] || "_site")
failures = []
external_links = []

def html_files(site_dir)
  Dir[site_dir.join("**", "*.html").to_s]
end

def local_target?(value)
  return false if value.nil? || value.empty?
  return false if value.start_with?("#", "mailto:", "tel:", "javascript:", "//")

  uri = URI.parse(value)
  !uri.scheme && !uri.host
rescue URI::InvalidURIError
  false
end

def asset_path_for(site_dir, source_file, value)
  path = value.split("#", 2).first.split("?", 2).first
  return nil if path.empty?

  if path.start_with?("/")
    site_dir.join(path.sub(%r{\A/}, ""))
  else
    Pathname.new(source_file).dirname.join(path).cleanpath
  end
end

def existing_target?(path)
  return true if File.file?(path)
  return true if File.file?(File.join(path.to_s, "index.html"))

  false
end

html_files(site_dir).each do |file|
  body = File.read(file)
  body.scan(/\b(?:href|src)=["']([^"']+)["']/i).flatten.each do |target|
    uri = URI.parse(target) rescue nil
    external_links << "#{file}: #{target}" if uri&.scheme&.start_with?("http")
    next unless local_target?(target)

    path = asset_path_for(site_dir, file, target)
    next if path && existing_target?(path)

    failures << "#{file}: missing internal target #{target}"
  end
end

external_links = external_links.uniq
if external_links.any?
  warn "Warning: #{external_links.count} external links were not checked."
  external_links.first(20).each { |link| warn "  #{link}" }
  warn "  ... #{external_links.count - 20} more" if external_links.count > 20
end

if failures.any?
  warn "Broken internal links:"
  failures.uniq.each { |failure| warn "  #{failure}" }
  exit 1
end

puts "Internal local links passed."
