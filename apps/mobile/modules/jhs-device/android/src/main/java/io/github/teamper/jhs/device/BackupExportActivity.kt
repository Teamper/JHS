package io.github.teamper.jhs.device

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import java.io.File

class BackupExportActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (stagedFile()?.isFile != true) {
      finish()
      return
    }
    // Intent carries only the filename, so a recreated activity can resume the picker.
    if (savedInstanceState == null) {
      try {
        startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/json"
          putExtra(Intent.EXTRA_TITLE, this@BackupExportActivity.intent.getStringExtra(TITLE) ?: "JHS.json")
        }, CREATE_BACKUP)
      } catch (_: Exception) {
        report("系统文件选择器当前不可用。")
      }
    }
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != CREATE_BACKUP) return
    val target = data?.data
    val file = stagedFile()
    if (resultCode != RESULT_OK || target == null || file == null) {
      file?.delete()
      finish()
      return
    }
    Thread {
      val success = runCatching {
        val output = contentResolver.openOutputStream(target, "wt") ?: error("无法打开目标文件")
        output.use { targetStream -> file.inputStream().use { it.copyTo(targetStream) } }
      }.isSuccess
      file.delete()
      runOnUiThread { report(if (success) "备份已保存" else "备份写入失败，请重新导出。") }
    }.start()
  }

  private fun stagedFile(): File? = intent.getStringExtra(CACHE_NAME)?.takeIf(::isBackupName)?.let { File(cacheDir, it) }

  private fun report(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    finish()
  }

  companion object {
    const val CACHE_NAME = "cache_name"
    const val TITLE = "title"
    private const val CREATE_BACKUP = 1921
    fun isBackupName(value: String) = Regex("jhs-[a-f0-9-]{36}\\.json").matches(value)
  }
}
