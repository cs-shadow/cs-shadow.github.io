#!/usr/bin/env ruby
# frozen_string_literal: true

site_dir = ARGV[0] || "_site"
list_path = ARGV[1] || ".github/ci/preserved_urls.txt"
netlify_config_path = ARGV[2] || "netlify.toml"

def netlify_redirects(path)
  return {} unless File.file?(path)

  redirects = {}
  current = nil

  File.readlines(path).each do |line|
    case line.strip
    when "[[redirects]]"
      redirects[current["from"]] = current if current&.fetch("from", nil)
      current = {}
    when /\A(from|to)\s*=\s*"([^"]+)"\z/
      current[Regexp.last_match(1)] = Regexp.last_match(2) if current
    when /\Astatus\s*=\s*(\d+)\z/
      current["status"] = Regexp.last_match(1).to_i if current
    end
  end

  redirects[current["from"]] = current if current&.fetch("from", nil)
  redirects
end

redirects = netlify_redirects(netlify_config_path)

def existing_url?(site_dir, url)
  relative = url.sub(%r{\A/}, "")
  candidates =
    if url.end_with?("/")
      [File.join(site_dir, relative, "index.html")]
    else
      [File.join(site_dir, relative), File.join(site_dir, relative, "index.html")]
    end

  candidates.any? { |path| File.file?(path) }
end

def preserved_redirect?(site_dir, redirects, url)
  redirect = redirects[url]
  return false unless redirect
  return false unless redirect["status"] == 301

  existing_url?(site_dir, redirect.fetch("to"))
end

missing = File.readlines(list_path).filter_map do |line|
  url = line.sub(/#.*/, "").strip
  next if url.empty?

  next if existing_url?(site_dir, url)
  next if preserved_redirect?(site_dir, redirects, url)

  url
end

if missing.any?
  warn "Missing preserved URLs:"
  missing.each { |url| warn "  #{url}" }
  exit 1
end

puts "Verified #{File.readlines(list_path).grep_v(/\A\s*(#|\z)/).count} preserved URLs."
