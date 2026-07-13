# frozen_string_literal: true

require "fileutils"
require "digest"
require "minitest/autorun"
require "open3"
require "socket"
require "tmpdir"

class ServeTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  SCRIPT = File.join(ROOT, "scripts", "serve")

  def setup
    @temporary_directory = Dir.mktmpdir("jekyll-preview-test-")
    @state_directory = File.join(@temporary_directory, "state")
    @ports = available_port_range
    @worktrees = []
    @servers = []
  end

  def teardown
    @worktrees.each { |worktree| serve(worktree, "stop") }
    @servers.each { |server| Process.kill("TERM", server) rescue nil }
    @servers.each { |server| Process.wait(server) rescue nil }
    FileUtils.remove_entry(@temporary_directory)
  end

  def test_start_uses_default_port_and_reuses_healthy_server
    worktree = worktree("one")

    output, status = serve(worktree, "start")
    assert status.success?, output
    assert_equal "http://127.0.0.1:#{@ports.first}/\n", output

    repeated_output, repeated_status = serve(worktree, "start")
    assert repeated_status.success?, repeated_output
    assert_equal output, repeated_output
  end

  def test_start_falls_back_when_default_port_is_occupied
    blocker = TCPServer.new("127.0.0.1", @ports.first)
    worktree = worktree("fallback")

    output, status = serve(worktree, "start")
    assert status.success?, output
    assert_equal "http://127.0.0.1:#{@ports[1]}/\n", output
  ensure
    blocker&.close
  end

  def test_state_is_isolated_by_absolute_worktree_path
    first = worktree("first")
    second = worktree("second")

    first_output, first_status = serve(first, "start")
    second_output, second_status = serve(second, "start")

    assert first_status.success?, first_output
    assert second_status.success?, second_output
    refute_equal state_file(first), state_file(second)
    assert File.exist?(state_file(first))
    assert File.exist?(state_file(second))
  end

  def test_start_removes_stale_state_before_starting_a_server
    worktree = worktree("stale")
    FileUtils.mkdir_p(@state_directory)
    File.write(state_file(worktree), "pid=999999\nport=#{@ports.first}\nworktree_path=#{worktree}\n")

    output, status = serve(worktree, "start")

    assert status.success?, output
    assert_equal "http://127.0.0.1:#{@ports.first}/\n", output
    assert_includes File.read(state_file(worktree)), "port=#{@ports.first}\n"
  end

  private

  def worktree(name)
    path = File.join(@temporary_directory, name)
    FileUtils.mkdir_p(File.join(path, "site"))
    @worktrees << path
    File.realpath(path)
  end

  def state_file(worktree)
    digest = Digest::SHA256.hexdigest(worktree)
    File.join(@state_directory, "cs-shadow-jekyll-preview-#{digest}.state")
  end

  def available_port_range
    20_000.upto(60_000) do |base|
      servers = (base...(base + 5)).map { |port| TCPServer.new("127.0.0.1", port) }
      servers.each(&:close)
      return (base...(base + 5)).to_a
    rescue Errno::EADDRINUSE
      servers&.each(&:close)
    end
    raise "could not find five consecutive available ports"
  end

  def serve(worktree, action)
    command = "ruby -rsocket -e 'server = TCPServer.new(\"127.0.0.1\", ENV.fetch(\"PREVIEW_PORT\")); trap(\"TERM\") { exit }; loop { socket = server.accept; socket.close }'"
    environment = {
      "JEKYLL_PREVIEW_COMMAND" => command,
      "JEKYLL_PREVIEW_PORTS" => @ports.join(" "),
      "JEKYLL_PREVIEW_WORKTREE" => worktree,
      "JEKYLL_PREVIEW_STATE_DIR" => @state_directory
    }
    Open3.capture2e(environment, SCRIPT, action, chdir: worktree)
  end
end
