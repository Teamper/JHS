package io.github.teamper.jhs.device

import android.content.Context
import android.content.Intent
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.WindowManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class JhsDeviceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val credentialStore get() = context.getSharedPreferences("jhs-credentials", Context.MODE_PRIVATE)
  private var migration: LegacySnapshotReader? = null

  override fun definition() = ModuleDefinition {
    Name("JhsDevice")

    AsyncFunction("readLegacySnapshot") { promise: Promise ->
      check(migration == null) { "旧片库正在读取。" }
      val reader = LegacySnapshotReader(context, promise) { migration = null }
      migration = reader
      reader.start()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getValue") { name: String ->
      credentialStore.getString(name, null)?.let { decrypt(name, it) }
    }

    AsyncFunction("setValue") { name: String, json: String? ->
      require(name.isNotBlank() && name.length <= 512) { "设置键无效。" }
      val editor = credentialStore.edit()
      if (json == null) editor.remove(name)
      else editor.putString(name, encrypt(name, json))
      check(editor.commit()) { "设置保存失败。" }
    }

    AsyncFunction("keys") { credentialStore.all.keys.sorted() }

    AsyncFunction("setPrivacy") { enabled: Boolean ->
      val window = appContext.currentActivity?.window ?: return@AsyncFunction
      val flag = WindowManager.LayoutParams.FLAG_SECURE
      window.setFlags(if (enabled) flag else 0, flag)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("exportBackup") { basename: String, filename: String ->
      require(BackupExportActivity.isBackupName(basename)) { "备份文件无效。" }
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      activity.startActivity(Intent(activity, BackupExportActivity::class.java).apply {
        putExtra(BackupExportActivity.CACHE_NAME, basename)
        putExtra(BackupExportActivity.TITLE, filename)
      })
    }.runOnQueue(Queues.MAIN)
  }

  // Use the existing package-local wrapping key and encoded values from V28.
  private fun key(create: Boolean): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey("jhs-values", null) as? SecretKey)?.let { return it }
    check(create) { "连接密钥不可用。" }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder("jhs-values", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }

  @Synchronized
  private fun encrypt(name: String, value: String): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key(true))
    cipher.updateAAD(name.encodeToByteArray())
    return listOf(cipher.iv, cipher.doFinal(value.encodeToByteArray())).joinToString(":") { Base64.encodeToString(it, Base64.NO_WRAP) }
  }

  private fun decrypt(name: String, value: String): String {
    val parts = value.split(':', limit = 2)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, Base64.decode(parts[0], Base64.DEFAULT)))
    cipher.updateAAD(name.encodeToByteArray())
    return cipher.doFinal(Base64.decode(parts[1], Base64.DEFAULT)).decodeToString()
  }
}
