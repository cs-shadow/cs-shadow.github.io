# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require_relative "../script/sync_goodreads"

class SyncGoodreadsTest < Minitest::Test
  FIXTURES = File.expand_path("fixtures", __dir__)

  def fixture(name)
    File.read(File.join(FIXTURES, name))
  end

  def test_parses_current_book_metadata
    book = GoodreadsSync.parse_feed(fixture("currently_reading.xml"), "currently-reading").first

    assert_equal "18423", book["id"]
    assert_equal "The Left Hand of Darkness", book["title"]
    assert_equal "Ursula K. Le Guin", book["author"]
    assert_equal "currently-reading", book["status"]
    assert_equal "2026-07-07", book["activity_date"]
    assert_equal "https://images.example/18423.jpg", book["cover_url"]
    refute book.key?("finished_date")
  end

  def test_parses_finished_book_metadata
    book = GoodreadsSync.parse_feed(fixture("finished.xml"), "read").first

    assert_equal "read", book["status"]
    assert_equal "2026-07-06", book["activity_date"]
    assert_equal "2026-07-06", book["finished_date"]
  end

  def test_allows_missing_cover_and_uses_default_goodreads_link
    book = GoodreadsSync.parse_feed(fixture("missing_cover.xml"), "read").first

    refute book.key?("cover_url")
    assert_equal "https://www.goodreads.com/book/show/13642", book["goodreads_url"]
  end

  def test_allows_missing_activity_date
    book = GoodreadsSync.parse_feed(fixture("missing_date.xml"), "currently-reading").first

    refute book.key?("activity_date")
  end

  def test_rejects_malformed_feed
    assert_raises(GoodreadsSync::Error) do
      GoodreadsSync.parse_feed(fixture("malformed.xml"), "read")
    end
  end

  def test_empty_feed_produces_no_books
    assert_empty GoodreadsSync.parse_feed(fixture("empty.xml"), "currently-reading")
  end

  def test_output_is_deterministic_and_sorted_by_latest_activity
    current = GoodreadsSync.parse_feed(fixture("currently_reading.xml"), "currently-reading")
    finished = GoodreadsSync.parse_feed(fixture("finished.xml"), "read")

    first = GoodreadsSync.serialized(GoodreadsSync.normalize(current + finished))
    second = GoodreadsSync.serialized(GoodreadsSync.normalize(finished + current))

    assert_equal first, second
    assert_operator first.index("18423"), :<, first.index("60931")
  end

  def test_generated_display_data_is_limited_after_activity_sorting
    books = (1..13).map do |number|
      {
        "id" => number.to_s,
        "activity_date" => format("2026-06-%02d", number)
      }
    end

    displayed = GoodreadsSync.displayed(books)

    assert_equal 12, displayed.length
    assert_equal "13", displayed.first.fetch("id")
    refute_includes displayed.map { |book| book.fetch("id") }, "1"
  end

  def test_write_is_no_op_when_content_is_unchanged
    Dir.mktmpdir do |directory|
      destination = File.join(directory, "books.yml")
      content = GoodreadsSync.serialized(
        GoodreadsSync.parse_feed(fixture("finished.xml"), "read")
      )

      assert GoodreadsSync.write_if_changed(destination, content)
      modified_at = File.mtime(destination)
      refute GoodreadsSync.write_if_changed(destination, content)
      assert_equal modified_at, File.mtime(destination)
    end
  end

  def test_parse_failure_does_not_erase_existing_data
    Dir.mktmpdir do |directory|
      destination = File.join(directory, "books.yml")
      File.write(destination, "last successful data\n")

      assert_raises(GoodreadsSync::Error) do
        books = GoodreadsSync.parse_feed(fixture("malformed.xml"), "read")
        GoodreadsSync.write_if_changed(destination, GoodreadsSync.serialized(books))
      end
      assert_equal "last successful data\n", File.read(destination)
    end
  end
end
