# frozen_string_literal: true

require "fileutils"
require "minitest/autorun"
require "open3"
require "tmpdir"
require "yaml"

class SiteRenderTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)

  def test_homepage_renders_twelve_recent_books_without_archive_or_goodreads_links
    Dir.mktmpdir("reading-site-", ROOT) do |directory|
      source = File.join(directory, "site")
      destination = File.join(directory, "_site")
      FileUtils.mkdir_p(source)
      entries = Dir.glob(File.join(ROOT, "site", "*"), File::FNM_DOTMATCH)
        .reject { |entry| %w[. ..].include?(File.basename(entry)) }
      FileUtils.cp_r(entries, source)
      books = (1..13).map do |number|
        {
          "id" => number.to_s,
          "title" => "Book #{number}",
          "author" => "Author #{number}",
          "status" => number.odd? ? "currently-reading" : "read",
          "activity_date" => format("2026-07-%02d", 14 - number),
          "cover_url" => number == 1 ? "https://images.example/1.jpg" : nil,
          "goodreads_url" => "https://www.goodreads.com/book/show/#{number}"
        }.compact
      end
      File.write(
        File.join(source, "_data", "goodreads_books.yml"),
        YAML.dump(books)
      )
      File.write(File.join(source, "_posts", "2026-07-08-book-2-review.md"), <<~MARKDOWN)
        ---
        title: Book 2 review
        goodreads_id: "2"
        ---
        Review body.
      MARKDOWN

      command = [
        "bundle", "exec", "jekyll", "build", "--source", source,
        "--destination", destination, "--strict_front_matter"
      ]
      output, status = Open3.capture2e(*command, chdir: ROOT)
      assert status.success?, output

      homepage = File.read(File.join(destination, "index.html"))
      refute File.exist?(File.join(destination, "reading", "index.html"))
      refute_includes homepage, "goodreads.com"
      refute_includes homepage, "See all reading"
      assert_includes homepage, 'href="/book-2-review/"'
      assert_includes homepage, "Book 12"
      refute_includes homepage, "Book 13"
      assert_includes homepage, "book-cover-placeholder.svg"
      assert_includes homepage, "https://images.example/1.jpg"
      assert_equal 12, homepage.scan('class="reading-teaser-book"').length
    end
  end

  def test_reading_grid_has_desktop_and_responsive_column_counts
    styles = File.read(File.join(ROOT, "site", "assets", "css", "main.sass"))

    assert_match(/grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/, styles)
    assert_match(/@include respond-to\(800\).*?repeat\(3,/m, styles)
    assert_match(/@include respond-to\(640\).*?repeat\(2,/m, styles)
  end

  def test_tool_pages_render_recent_settings_controls
    Dir.mktmpdir("tools-site-", ROOT) do |directory|
      destination = File.join(directory, "_site")
      command = [
        "bundle", "exec", "jekyll", "build", "--source", File.join(ROOT, "site"),
        "--destination", destination, "--strict_front_matter"
      ]
      output, status = Open3.capture2e(*command, chdir: ROOT)
      assert status.success?, output

      scalar_triads = File.read(File.join(destination, "tools", "scalar-triads", "index.html"))
      chordinator = File.read(File.join(destination, "tools", "guitar-chordinator", "index.html"))

      assert_includes scalar_triads, 'id="scale-recent-settings"'
      assert_includes scalar_triads, 'id="scale-clear-history"'
      assert_includes chordinator, 'id="chordinator-recent-settings"'
      assert_includes chordinator, 'id="chordinator-clear-history"'
    end
  end
end
